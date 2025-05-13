import { DidDocument } from '../types/did';
import { BTCO_METHOD, ERROR_CODES } from '../utils/constants';
import { isValidBtcoDid, parseBtcoDid } from '../utils/validators';
import { validateDidDocument, deserializeDidDocument } from './did-document';
import { BitcoinNetwork } from '../types';
import { ResourceProvider } from '../resources/providers/types';
import { ProviderFactory, ProviderType } from '../resources/providers/provider-factory';
import { extractCborMetadata } from '../utils/cbor-utils';

/**
 * Options for DID resolution
 */
export interface DidResolutionOptions {
  /**
   * Whether to accept something less than the latest version
   */
  accept?: string[];
  
  /**
   * API endpoint for the Ordinals indexer
   */
  apiEndpoint?: string;
  
  /**
   * API key for the Ordinals indexer
   */
  apiKey?: string;
  
  /**
   * Bitcoin network to use
   */
  network?: BitcoinNetwork;
  
  /**
   * Timeout for network requests in milliseconds
   */
  timeout?: number;
  
  /**
   * Whether to bypass cache
   */
  noCache?: boolean;
}

/**
 * DID Resolution result metadata
 */
export interface DidResolutionMetadata {
  /**
   * The content type of the DID document
   */
  contentType?: string;
  
  /**
   * When the DID document was created
   */
  created?: string;
  
  /**
   * The error code if resolution failed
   */
  error?: string;
  
  /**
   * The version ID of the resolved DID document
   */
  versionId?: string;
  
  /**
   * The next version ID of the DID document if available
   */
  nextVersionId?: string;
  
  /**
   * Whether this is the latest version of the DID document
   */
  isLatest?: boolean;
}

/**
 * DID Document metadata
 */
export interface DidDocumentMetadata {
  /**
   * When the DID document was created
   */
  created?: string;
  
  /**
   * When the DID document was last updated
   */
  updated?: string;
  
  /**
   * Whether the DID has been deactivated
   */
  deactivated?: boolean;
  
  /**
   * The version ID of the DID document
   */
  versionId?: string;
  
  /**
   * The next version ID of the DID document
   */
  nextVersionId?: string;
}

/**
 * Result of DID resolution
 */
export interface DidResolutionResult {
  /**
   * The resolution metadata
   */
  didResolutionMetadata: DidResolutionMetadata;
  
  /**
   * The resolved DID document
   */
  didDocument: DidDocument | null;
  
  /**
   * Metadata about the DID document
   */
  didDocumentMetadata: DidDocumentMetadata;
}

/**
 * DID URL parsing result
 */
export interface ParsedDidUrl {
  /**
   * The DID method
   */
  method: string;
  
  /**
   * The method-specific ID
   */
  id: string;
  
  /**
   * The full DID
   */
  did: string;
  
  /**
   * The path component of the DID URL
   */
  path?: string;
  
  /**
   * The query component of the DID URL
   */
  query?: string;
  
  /**
   * The fragment component of the DID URL
   */
  fragment?: string;
  
  /**
   * The version index parsed from the path
   */
  versionIndex?: number;
}

// Simple in-memory cache for DID resolution results
interface CacheEntry {
  result: DidResolutionResult;
  timestamp: number;
}

/**
 * Resolver for BTCO DIDs
 */
export class DidResolver {
  private readonly provider: ResourceProvider;
  private readonly network: BitcoinNetwork;
  private readonly cacheEnabled: boolean;
  private readonly cacheTtl: number;
  private readonly cache: Map<string, CacheEntry>;
  
  /**
   * Creates a new DidResolver
   * 
   * @param options - Options for the resolver
   */
  constructor(options: DidResolutionOptions = {}) {
    this.network = options.network || 'mainnet';
    const providerConfig = {
      type: ProviderType.ORDISCAN,
      options: {
        apiKey: options.apiKey || '',
        apiEndpoint: options.apiEndpoint,
        timeout: options.timeout,
        network: this.network
      }
    };
    this.provider = ProviderFactory.createProvider(providerConfig);
    this.cacheEnabled = true; // Default to enabled
    this.cacheTtl = 300000; // Default to 5 minutes
    this.cache = new Map<string, CacheEntry>();
  }
  
  /**
   * Resolves a DID to a DID document
   * 
   * @param didUrl - The DID URL to resolve
   * @param options - Resolution options
   * @returns The DID resolution result
   */
  async resolve(didUrl: string, options: DidResolutionOptions = {}): Promise<DidResolutionResult> {
    try {
      // Parse the DID URL
      const parsed = this.parseDidUrl(didUrl);
      if (!parsed) {
        return this.createErrorResult(ERROR_CODES.INVALID_DID, 'Invalid DID URL format');
      }
      
      // Check if DID method is supported
      if (parsed.method !== BTCO_METHOD) {
        return this.createErrorResult(ERROR_CODES.METHOD_NOT_SUPPORTED, `DID method '${parsed.method}' is not supported`);
      }
      
      // Check cache if enabled and not bypassed
      const cacheKey = didUrl;
      if (this.cacheEnabled && !options.noCache) {
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTtl) {
          return cached.result;
        }
      }
      
      // Extract satoshi number
      const satNumber = parseBtcoDid(`${parsed.did}`)?.satNumber;
      if (!satNumber) {
        return this.createErrorResult(ERROR_CODES.INVALID_DID, 'Could not parse satoshi number from DID');
      }
      
      // Query indexer for inscription
      const satInfo = await this.provider.getSatInfo(satNumber);
      if (!satInfo || !satInfo.inscription_ids || satInfo.inscription_ids.length === 0) {
        return this.createErrorResult(ERROR_CODES.NOT_FOUND, `No inscriptions found for satoshi ${satNumber}`);
      }
      
      // Determine which inscription to use based on version index
      const versionIndex = parsed.versionIndex !== undefined ? parsed.versionIndex : 0;
      if (versionIndex >= satInfo.inscription_ids.length) {
        return this.createErrorResult(ERROR_CODES.NOT_FOUND, `No inscription found at index ${versionIndex} for satoshi ${satNumber}`);
      }
      
      const inscriptionId = satInfo.inscription_ids[versionIndex];
      const inscription = await this.provider.resolveInscription(inscriptionId);
      
      // Extract and decode CBOR metadata to get DID Document
      let didDocument: DidDocument | null = null;
      const metadata = inscription.metadata;
      
      if (metadata) {
        const decodedMetadata = extractCborMetadata(metadata);
        if (decodedMetadata) {
          // Validate it's a DID Document
          if (typeof decodedMetadata === 'object' && decodedMetadata !== null) {
            try {
              // Try to interpret it as a DID Document
              const didDocString = JSON.stringify(decodedMetadata);
              didDocument = deserializeDidDocument(didDocString);
              
              // If we have a document, validate that its ID matches the requested DID
              if (didDocument && didDocument.id !== parsed.did) {
                console.warn(`DID mismatch: Document ID ${didDocument.id} does not match requested DID ${parsed.did}`);
                return this.createErrorResult(ERROR_CODES.INVALID_DID, 'DID Document ID does not match requested DID');
              }
            } catch (error) {
              console.error('Error deserializing DID Document:', error);
              return this.createErrorResult(ERROR_CODES.INVALID_DID, 'Invalid DID Document format');
            }
          }
        }
      }
      
      // Create result with discovered information
      const result: DidResolutionResult = {
        didResolutionMetadata: {
          contentType: 'application/did+json',
          versionId: versionIndex.toString(),
          nextVersionId: versionIndex < satInfo.inscription_ids.length - 1 ? (versionIndex + 1).toString() : undefined,
          isLatest: versionIndex === satInfo.inscription_ids.length - 1,
          created: inscription.timestamp ? new Date(inscription.timestamp).toISOString() : undefined
        },
        didDocument: didDocument,
        didDocumentMetadata: {
          created: inscription.timestamp ? new Date(inscription.timestamp).toISOString() : undefined,
          versionId: versionIndex.toString(),
          nextVersionId: versionIndex < satInfo.inscription_ids.length - 1 ? (versionIndex + 1).toString() : undefined,
          deactivated: didDocument?.deactivated || false
        }
      };
      
      // Cache the result if caching is enabled
      if (this.cacheEnabled) {
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }
      
      return result;
    } catch (error) {
      console.error('[DidResolver] Error resolving DID:', error);
      return this.createErrorResult(ERROR_CODES.RESOLUTION_FAILED, error instanceof Error ? error.message : 'Unknown error during resolution');
    }
  }
  
  /**
   * Parses a DID URL into its components
   * 
   * @param didUrl - The DID URL to parse
   * @returns The parsed DID URL or null if invalid
   */
  private parseDidUrl(didUrl: string): ParsedDidUrl | null {
    // Regular expression to parse DID URL components
    // did:method:id[/path][?query][#fragment]
    const didUrlRegex = /^did:([a-z0-9]+):([a-zA-Z0-9.%-]+)(\/[^?#]*)?([\?][^#]*)?(#.*)?$/;
    
    const match = didUrlRegex.exec(didUrl);
    if (!match) return null;
    
    const [, method, id, path, query, fragment] = match;
    const did = `did:${method}:${id}`;
    
    // Parse version index from path if present
    let versionIndex: number | undefined = undefined;
    if (path) {
      const pathWithoutSlash = path.startsWith('/') ? path.substring(1) : path;
      const pathIndex = parseInt(pathWithoutSlash, 10);
      if (!isNaN(pathIndex) && pathIndex >= 0) {
        versionIndex = pathIndex;
      }
    }
    
    return {
      method,
      id,
      did,
      path: path || undefined,
      query: query || undefined,
      fragment: fragment || undefined,
      versionIndex
    };
  }
  
  /**
   * Creates an error result for DID resolution
   * 
   * @param code - The error code
   * @param message - The error message
   * @returns A DID resolution result with the error
   */
  private createErrorResult(code: string, message: string): DidResolutionResult {
    return {
      didResolutionMetadata: {
        error: code,
        contentType: 'application/did+json'
      },
      didDocument: null,
      didDocumentMetadata: {}
    };
  }
  
  /**
   * Clears the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
} 