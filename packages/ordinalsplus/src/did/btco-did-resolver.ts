import { BitcoinNetwork } from '../types';
import { ResourceProvider } from '../resources/providers/types';
import { ProviderFactory, ProviderType } from '../resources/providers/provider-factory';
import { extractCborMetadata } from '../utils/cbor-utils';
import { DidDocument } from '../types/did';
import { OrdNodeProvider } from '../resources/providers';

/**
 * Individual inscription data for BTCO DID resources
 */
export interface BtcoInscriptionData {
  inscriptionId: string;
  content: string;
  metadata: any;
  contentUrl?: string;
  contentType?: string;
  isValidDid?: boolean;
  didDocument?: DidDocument | null;
  error?: string;
}

/**
 * BTCO DID Resolution result
 */
export interface BtcoDidResolutionResult {
  /**
   * The resolved DID document, null if resolution failed (for compatibility)
   */
  didDocument: DidDocument | null;
  
  /**
   * All inscriptions found on the satoshi with their data
   */
  inscriptions?: BtcoInscriptionData[];
  
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
    totalInscriptions?: number;
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
   * Resource provider for ordinals/inscriptions data
   */
  provider?: ResourceProvider;
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
  private readonly options: BtcoDidResolutionOptions;

  constructor(options: BtcoDidResolutionOptions = {}) {
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
   * Create a default provider if none is provided
   */
  private createDefaultProvider(network: string): ResourceProvider {
    // Map network names to BitcoinNetwork type
    let bitcoinNetwork: BitcoinNetwork;
    switch (network) {
      case 'mainnet':
      case 'main':
      default:
        bitcoinNetwork = 'mainnet';
        const apiKey = process.env.ORDISCAN_API_KEY;
        if (!apiKey) {
          return new OrdNodeProvider({
            nodeUrl: process.env.MAINNET_ORD_NODE_URL!,
            network: bitcoinNetwork
          });
        }
        const providerConfig = {
          type: ProviderType.ORDISCAN,
          options: {
            apiKey,
            apiEndpoint: 'https://api.ordiscan.com/v1',
            timeout: 30000,
            network: bitcoinNetwork
          }
        };
        return ProviderFactory.createProvider(providerConfig);
      case 'test':
      case 'testnet':
        bitcoinNetwork = 'testnet';
        return ProviderFactory.createProvider({
          type: ProviderType.ORD,
          options: {
            nodeUrl: process.env.TESTNET_ORD_NODE_URL!,
            timeout: 30000,
            network: bitcoinNetwork
          }
        });
      case 'sig':
      case 'signet':
        bitcoinNetwork = 'signet';
        return ProviderFactory.createProvider({
          type: ProviderType.ORD,
          options: {
            nodeUrl: process.env.SIGNET_ORD_NODE_URL!,
            timeout: 30000,
            network: bitcoinNetwork
          }
        });
    }
  }

  /**
   * Resolve a BTCO DID according to the specification
   * Returns all inscriptions on the satoshi with their metadata
   */
  async resolve(did: string, options: BtcoDidResolutionOptions = {}): Promise<BtcoDidResolutionResult> {
    try {
      // Step 1: Parse the DID
      console.log('resolving did', did);
      const parsed = this.parseBtcoDid(did);
      if (!parsed) {
        return this.createErrorResult('invalidDid', `Invalid BTCO DID format: ${did}`);
      }

      const { satNumber, path, network } = parsed;
      console.log('network', network);
      
      // Use provided provider or create a default one for the network
      const provider = options.provider || this.options.provider || this.createDefaultProvider(network);

      // Step 2: Get all inscriptions on this satoshi
      let inscriptionIds: string[];
      try {
        const satInfo = await provider.getSatInfo(satNumber);
        if (!satInfo || !satInfo.inscription_ids || satInfo.inscription_ids.length === 0) {
          return this.createErrorResult('notFound', 
            `No inscriptions found on satoshi ${satNumber}`
          );
        }
        
        inscriptionIds = satInfo.inscription_ids;
      } catch (error) {
        return this.createErrorResult('notFound', 
          `Failed to retrieve inscriptions for satoshi ${satNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      // Step 3: Retrieve content and metadata for ALL inscriptions
      const inscriptionDataList: BtcoInscriptionData[] = [];
      const expectedDid = `${this.getDidPrefix(network)}:${satNumber}`;
      const didPattern = new RegExp(`^(?:BTCO DID: )?(${expectedDid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
      
      for (const inscriptionId of inscriptionIds) {
        const inscriptionData: BtcoInscriptionData = {
          inscriptionId,
          content: '',
          metadata: null
        };

        try {
          // Get inscription details
          const inscription = await provider.resolveInscription(inscriptionId);
          if (!inscription) {
            inscriptionData.error = `Inscription ${inscriptionId} not found`;
            inscriptionDataList.push(inscriptionData);
            continue;
          }
          
          inscriptionData.contentUrl = inscription.content_url;
          inscriptionData.contentType = inscription.content_type;

          // Fetch the actual content from the content URL
          try {
            const response = await fetch(inscription.content_url);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            inscriptionData.content = await response.text();
          } catch (error) {
            inscriptionData.error = `Failed to fetch content: ${error instanceof Error ? error.message : 'Unknown error'}`;
            inscriptionDataList.push(inscriptionData);
            continue;
          }
          
          // Extract CBOR metadata
          try {
            inscriptionData.metadata = await provider.getMetadata(inscriptionId);
          } catch (error) {
            console.warn(`Failed to decode CBOR metadata for ${inscriptionId}:`, error);
            inscriptionData.metadata = null;
          }

          // Check if this inscription contains a valid DID
          inscriptionData.isValidDid = didPattern.test(inscriptionData.content);

          // If it's a valid DID inscription, try to extract the DID document
          if (inscriptionData.isValidDid && inscriptionData.metadata) {
            try {
              if (typeof inscriptionData.metadata === 'object' && inscriptionData.metadata !== null) {
                const didDocument = inscriptionData.metadata as DidDocument;
                
                // Validate the DID document
                console.log('didDocument', didDocument);
                if (this.isValidDidDocument(didDocument) && didDocument.id === expectedDid) {
                  inscriptionData.didDocument = didDocument;
                } else {
                  inscriptionData.error = 'Invalid DID document structure or mismatched ID';
                }
              }
            } catch (error) {
              inscriptionData.error = `Failed to parse DID document: ${error instanceof Error ? error.message : 'Unknown error'}`;
            }
          }

          // Check for deactivation marker
          if (inscriptionData.content.includes('🔥')) {
            inscriptionData.didDocument = null;
            if (!inscriptionData.error) {
              inscriptionData.error = 'DID has been deactivated';
            }
          }

        } catch (error) {
          inscriptionData.error = `Failed to process inscription: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }

        inscriptionDataList.push(inscriptionData);
      }

      // Find the most recent valid DID document for backward compatibility
      let latestValidDidDocument: DidDocument | null = null;
      let latestInscriptionId: string | undefined;

      // Process inscriptions in reverse order (most recent first)
      for (let i = inscriptionDataList.length - 1; i >= 0; i--) {
        const inscriptionData = inscriptionDataList[i];
        if (inscriptionData.didDocument && !inscriptionData.error) {
          latestValidDidDocument = inscriptionData.didDocument;
          latestInscriptionId = inscriptionData.inscriptionId;
          break;
        }
      }

      return {
        didDocument: latestValidDidDocument,
        inscriptions: inscriptionDataList,
        resolutionMetadata: {
          inscriptionId: latestInscriptionId,
          satNumber,
          network,
          totalInscriptions: inscriptionDataList.length
        },
        didDocumentMetadata: {
          inscriptionId: latestInscriptionId,
          network
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during resolution';
      
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