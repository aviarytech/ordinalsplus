import { BitcoinNetwork } from '../types';
import { ResourceProvider } from '../resources/providers/types';
import { ProviderFactory, ProviderType } from '../resources/providers/provider-factory';
import { extractCborMetadata } from '../utils/cbor-utils';
import { DidDocument } from '../types/did';
import { AuditCategory, AuditSeverity, logDidDocumentResolution } from '../utils/audit-logger';

/**
 * BTCO DID Resolution result
 */
export interface BtcoDidResolutionResult {
  /**
   * The resolved DID document, null if resolution failed
   */
  didDocument: DidDocument | null;
  
  /**
   * Resolution metadata including any errors
   */
  resolutionMetadata: {
    contentType?: string;
    error?: string;
    message?: string;
    inscriptionId?: string;
    satNumber?: string;
    created?: string;
    deactivated?: boolean;
    network?: string;
  };
  
  /**
   * DID document metadata
   */
  didDocumentMetadata: {
    created?: string;
    updated?: string;
    deactivated?: boolean;
    inscriptionId?: string;
    network?: string;
  };
}

/**
 * Options for BTCO DID resolution
 */
export interface BtcoDidResolutionOptions {
  /**
   * Bitcoin network to use (mainnet, testnet, signet)
   */
  network?: BitcoinNetwork;
  
  /**
   * API endpoint for the Ordinals indexer
   */
  apiEndpoint?: string;
  
  /**
   * API key for the Ordinals indexer
   */
  apiKey?: string;
  
  /**
   * Timeout for network requests in milliseconds
   */
  timeout?: number;
  
  /**
   * Whether to enable audit logging
   */
  enableAudit?: boolean;
  
  /**
   * The actor performing the resolution (for auditing)
   */
  actor?: string;
}

/**
 * BTCO DID Resolver implementing the BTCO DID Method Specification
 * 
 * According to the spec:
 * 1. Retrieve the content from the most recent inscription on the satoshi 
 *    associated with the method-specific identifier.
 * 2. If the content is a valid DID retrieve the metadata and CBOR decode it 
 *    as JSON to retrieve the current document.
 * 3. Ensure the document `id` property matches the inscription content.
 * 4. Ensure the inscription is on the sat specified in the method-specific identifier.
 */
export class BtcoDidResolver {
  private readonly defaultNetwork: BitcoinNetwork;
  private readonly options: BtcoDidResolutionOptions;

  constructor(options: BtcoDidResolutionOptions = {}) {
    this.defaultNetwork = options.network || 'mainnet';
    this.options = options;
  }

  /**
   * Parse a BTCO DID to extract the satoshi number and optional version/path
   */
  private parseBtcoDid(did: string): { satNumber: string; path?: string; network: string } | null {
    // BTCO DID format: did:btco[:[network]]:<sat-number>[/<path>]
    const regex = /^did:btco(?::(test|sig))?:([0-9]+)(?:\/(.+))?$/;
    const match = did.match(regex);
    
    if (!match) {
      return null;
    }
    
    const [, networkSuffix, satNumber, path] = match;
    const network = networkSuffix || 'mainnet';
    
    return {
      satNumber,
      path,
      network
    };
  }

  /**
   * Get the network-specific DID prefix
   */
  private getDidPrefix(network: string): string {
    switch (network) {
      case 'test':
      case 'testnet':
        return 'did:btco:test';
      case 'sig':
      case 'signet':
        return 'did:btco:sig';
      default:
        return 'did:btco';
    }
  }

  /**
   * Create a provider for the specified network
   */
  private createProviderForNetwork(network: string): ResourceProvider {
    // Map network names to BitcoinNetwork type
    let bitcoinNetwork: BitcoinNetwork;
    switch (network) {
      case 'test':
      case 'testnet':
        bitcoinNetwork = 'testnet';
        break;
      case 'sig':
      case 'signet':
        bitcoinNetwork = 'signet';
        break;
      default:
        bitcoinNetwork = 'mainnet';
        break;
    }

    // Use provided API key or try environment variables
    const apiKey = this.options.apiKey || 
                   process.env.ORDISCAN_API_KEY || 
                   (typeof window !== 'undefined' && (window as any).ORDISCAN_API_KEY);

    if (!apiKey) {
      throw new Error('Ordiscan API key is required. Please provide it via options.apiKey or set the ORDISCAN_API_KEY environment variable.');
    }

    const providerConfig = {
      type: ProviderType.ORDISCAN,
      options: {
        apiKey,
        apiEndpoint: this.options.apiEndpoint || 'https://api.ordiscan.com/v1',
        timeout: this.options.timeout || 30000,
        network: bitcoinNetwork
      }
    };
    return ProviderFactory.createProvider(providerConfig);
  }

  /**
   * Resolve a BTCO DID according to the specification
   */
  async resolve(did: string, options: BtcoDidResolutionOptions = {}): Promise<BtcoDidResolutionResult> {
    const startTime = Date.now();
    
    try {
      // Step 1: Parse the DID
      const parsed = this.parseBtcoDid(did);
      if (!parsed) {
        return this.createErrorResult('invalidDid', `Invalid BTCO DID format: ${did}`);
      }

      const { satNumber, path, network } = parsed;
      
      // Create a provider for the network specified in the DID
      const provider = this.createProviderForNetwork(network);

      // Step 2: Get inscriptions on this satoshi
      let inscriptionId: string;
      try {
        const satInfo = await provider.getSatInfo(satNumber);
        
        if (!satInfo || !satInfo.inscription_ids || satInfo.inscription_ids.length === 0) {
          return this.createErrorResult('notFound', 
            `No inscriptions found on satoshi ${satNumber}`
          );
        }
        
        // Get the most recent inscription (last in the array)
        inscriptionId = satInfo.inscription_ids[satInfo.inscription_ids.length - 1];
        
      } catch (error) {
        return this.createErrorResult('notFound', 
          `Failed to retrieve inscriptions for satoshi ${satNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Step 3: Retrieve the inscription content and metadata
      let inscriptionContent: string;
      let metadata: any;
      
      try {
        const inscription = await provider.resolveInscription(inscriptionId);
        
        if (!inscription) {
          return this.createErrorResult('notFound', 
            `Inscription ${inscriptionId} not found`
          );
        }
        
        // Fetch the actual content from the content URL
        try {
          const response = await fetch(inscription.content_url);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          inscriptionContent = await response.text();
        } catch (error) {
          return this.createErrorResult('notFound', 
            `Failed to fetch inscription content from ${inscription.content_url}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
        
        // Extract CBOR metadata if present
        if (inscription.metadata) {
          try {
            metadata = extractCborMetadata(inscription.metadata);
          } catch (error) {
            console.warn('Failed to decode CBOR metadata:', error);
            metadata = null;
          }
        }
        
      } catch (error) {
        return this.createErrorResult('notFound', 
          `Failed to retrieve inscription ${inscriptionId}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Step 4: Check if inscription content contains a valid DID
      const expectedDid = `${this.getDidPrefix(network)}:${satNumber}`;
      const didPattern = new RegExp(`^(?:BTCO DID: )?(${expectedDid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
      
      if (!didPattern.test(inscriptionContent)) {
        return this.createErrorResult('invalidDidDocument', 
          `Inscription content does not contain expected DID ${expectedDid}. Content: ${inscriptionContent.substring(0, 100)}...`
        );
      }

      // Step 5: Check for deactivation
      if (inscriptionContent.includes('🔥') && !metadata) {
        return {
          didDocument: null,
          resolutionMetadata: {
            inscriptionId,
            satNumber,
            deactivated: true,
            message: 'DID has been deactivated'
          },
          didDocumentMetadata: {
            deactivated: true,
            inscriptionId
          }
        };
      }

      // Step 6: Extract DID document from metadata
      if (!metadata) {
        return this.createErrorResult('invalidDidDocument', 
          'No CBOR metadata found containing DID document'
        );
      }

      let didDocument: DidDocument;
      try {
        // The DID document should be in the metadata
        if (typeof metadata === 'object' && metadata !== null) {
          didDocument = metadata as DidDocument;
        } else {
          return this.createErrorResult('invalidDidDocument', 
            'Invalid DID document format in metadata'
          );
        }
      } catch (error) {
        return this.createErrorResult('invalidDidDocument', 
          `Failed to parse DID document: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Step 7: Validate DID document
      if (!didDocument.id) {
        return this.createErrorResult('invalidDidDocument', 
          'DID document missing required id field'
        );
      }

      // Ensure the document ID matches the expected DID
      if (didDocument.id !== expectedDid) {
        return this.createErrorResult('invalidDidDocument', 
          `DID document id (${didDocument.id}) does not match expected DID (${expectedDid})`
        );
      }

      // Step 8: Validate DID document structure
      if (!this.isValidDidDocument(didDocument)) {
        return this.createErrorResult('invalidDidDocument', 
          'DID document does not conform to DID Core specification'
        );
      }

      // Log successful resolution
      if (options.enableAudit || this.options.enableAudit) {
        await logDidDocumentResolution(
          didDocument.id,
          options.actor || this.options.actor,
          {
            inscriptionId,
            satNumber,
            network,
            resolutionTimeMs: Date.now() - startTime
          }
        );
      }

      return {
        didDocument,
        resolutionMetadata: {
          contentType: 'application/did+ld+json',
          inscriptionId,
          satNumber,
          network
        },
        didDocumentMetadata: {
          inscriptionId,
          network
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during resolution';
      
      if (options.enableAudit || this.options.enableAudit) {
        await logDidDocumentResolution(
          did,
          options.actor || this.options.actor,
          {
            error: errorMessage,
            resolutionTimeMs: Date.now() - startTime
          }
        );
      }
      
      return this.createErrorResult('internalError', errorMessage);
    }
  }

  /**
   * Validate that an object conforms to the DID Document specification
   */
  private isValidDidDocument(doc: any): doc is DidDocument {
    if (!doc || typeof doc !== 'object') {
      return false;
    }

    // Required fields
    if (!doc.id || typeof doc.id !== 'string') {
      return false;
    }

    // @context should be present and include DID context
    if (!doc['@context']) {
      return false;
    }

    const contexts = Array.isArray(doc['@context']) ? doc['@context'] : [doc['@context']];
    if (!contexts.includes('https://www.w3.org/ns/did/v1') && !contexts.includes('https://w3id.org/did/v1')) {
      return false;
    }

    // Verification methods should be an array if present
    if (doc.verificationMethod && !Array.isArray(doc.verificationMethod)) {
      return false;
    }

    // Authentication should be an array if present
    if (doc.authentication && !Array.isArray(doc.authentication)) {
      return false;
    }

    return true;
  }

  /**
   * Create an error result
   */
  private createErrorResult(error: string, message: string): BtcoDidResolutionResult {
    return {
      didDocument: null,
      resolutionMetadata: {
        error,
        message
      },
      didDocumentMetadata: {}
    };
  }
} 