import { Elysia } from 'elysia';
import { getProvider } from '../services/providerService';
import { decodeCbor } from '../../../ordinalsplus/src';

/**
 * BTCO DID Resolution Helper
 * Implements the BTCO DID Method Specification resolution process
 */
class BtcoDidResolutionService {
  /**
   * Parse a BTCO DID to extract components
   */
  private parseBtcoDid(did: string): { satNumber: string; network: string } | null {
    const regex = /^did:btco(?::(test|sig))?:([0-9]+)(?:\/(.+))?$/;
    const match = did.match(regex);
    
    if (!match) {
      return null;
    }
    
    const [fullMatch, networkSuffix, satNumber, pathComponent] = match;
    const network = networkSuffix || 'mainnet';
    
    // Ensure satNumber is defined
    if (!satNumber) {
      return null;
    }
    
    return { satNumber, network };
  }

  /**
   * Map DID network suffix to provider network name
   */
  private getProviderNetwork(network: string): string {
    switch (network) {
      case 'sig':
        return 'signet';
      case 'test':
        return 'testnet';
      default:
        return 'mainnet';
    }
  }

  /**
   * Build expected DID string for validation
   */
  private buildExpectedDid(satNumber: string, providerNetwork: string): string {
    switch (providerNetwork) {
      case 'testnet':
        return `did:btco:test:${satNumber}`;
      case 'signet':
        return `did:btco:sig:${satNumber}`;
      default:
        return `did:btco:${satNumber}`;
    }
  }

  /**
   * Get the most recent inscription ID for a satoshi
   */
  private async getLatestInscriptionId(provider: any, satNumber: string): Promise<string> {
    const satInfo = await provider.getSatInfo(satNumber);
    
    if (!satInfo || !satInfo.inscription_ids || satInfo.inscription_ids.length === 0) {
      throw new Error(`No inscriptions found on satoshi ${satNumber}`);
    }
    
    // Return the most recent inscription (last in the array)
    return satInfo.inscription_ids[satInfo.inscription_ids.length - 1] as string;
  }

  /**
   * Validate inscription content contains expected DID
   */
  private async validateInscriptionContent(provider: any, inscriptionId: string, expectedDid: string): Promise<string> {
    const inscription = await provider.resolveInscription(inscriptionId);
    if (!inscription) {
      throw new Error(`Inscription ${inscriptionId} not found`);
    }
    
    // Fetch the actual content from the content URL
    const response = await fetch(inscription.content_url);
    if (!response.ok) {
      throw new Error(`Failed to fetch inscription content: HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    
    // Check if content contains expected DID
    const didPattern = new RegExp(`^(?:BTCO DID: )?(${expectedDid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
    if (!didPattern.test(content)) {
      throw new Error(`Inscription content does not contain expected DID ${expectedDid}`);
    }
    
    return content;
  }

  /**
   * Extract and validate DID document from metadata
   */
  private async extractDidDocument(provider: any, inscriptionId: string, expectedDid: string): Promise<any> {
    // Get metadata from the provider
    const rawMetadata = await provider.getMetadata(inscriptionId);
    if (!rawMetadata) {
      throw new Error('No CBOR metadata found. BTCO DID documents must be stored as CBOR metadata in inscriptions.');
    }
    
    // Decode CBOR metadata
    const metadata = decodeCbor(rawMetadata) as any;
    
    // Find the DID document in the metadata
    let didDocument = null;
    
    if (metadata.id === expectedDid || (metadata['@context'] && metadata.id)) {
      didDocument = metadata;
    } else if (metadata.didDocument) {
      didDocument = metadata.didDocument;
    } else if (metadata.standard && metadata.standard.id === expectedDid) {
      didDocument = metadata.standard;
    }
    
    if (!didDocument) {
      throw new Error(`CBOR metadata found but does not contain a valid DID document for ${expectedDid}`);
    }
    
    return didDocument;
  }

  /**
   * Resolve a BTCO DID according to the specification
   */
  async resolve(did: string) {
    try {
      // Step 1: Parse the DID
      const parsed = this.parseBtcoDid(did);
      if (!parsed) {
        return {
          status: 'error',
          message: `Invalid BTCO DID format: ${did}`,
          data: { error: 'invalidDid' }
        };
      }

      const { satNumber, network } = parsed;
      const providerNetwork = this.getProviderNetwork(network);
      const expectedDid = this.buildExpectedDid(satNumber, providerNetwork);
      
      // Step 2: Get provider for the network
      const provider = getProvider(providerNetwork);
      if (!provider) {
        return {
          status: 'error',
          message: `No provider available for network: ${network}`,
          data: { error: 'providerNotAvailable' }
        };
      }

      try {
        // Step 3: Get the latest inscription for this satoshi
        const inscriptionId = await this.getLatestInscriptionId(provider, satNumber);
        
        // Step 4: Validate inscription content
        const inscriptionContent = await this.validateInscriptionContent(provider, inscriptionId, expectedDid);
        
        // Step 5: Check for deactivation
        if (inscriptionContent.includes('🔥')) {
          return {
            status: 'success',
            data: {
              didDocument: null,
              resolutionMetadata: {
                inscriptionId,
                satNumber,
                deactivated: true,
                message: 'DID has been deactivated',
                network: providerNetwork
              },
              didDocumentMetadata: {
                deactivated: true,
                inscriptionId,
                network: providerNetwork
              }
            }
          };
        }

        // Step 6: Extract DID document from metadata
        const didDocument = await this.extractDidDocument(provider, inscriptionId, expectedDid);
        
        return {
          status: 'success',
          data: {
            didDocument,
            resolutionMetadata: {
              inscriptionId,
              satNumber,
              contentType: 'application/cbor',
              retrieved: new Date().toISOString(),
              network: providerNetwork
            },
            didDocumentMetadata: {
              inscriptionId,
              network: providerNetwork,
              created: didDocument.created || new Date().toISOString()
            }
          }
        };

      } catch (error) {
        return {
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error during resolution',
          data: { 
            error: 'resolutionFailed',
            satNumber,
            network: providerNetwork
          }
        };
      }

    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error during resolution',
        data: { error: 'internalError' }
      };
    }
  }
}

/**
 * DID Router - handles DID resolution endpoints
 */
export const didRouter = new Elysia({ prefix: '/api/dids' })
    .get('/:did/resolve', async ({ params, query }) => {
        // Decode the URL-encoded DID parameter
        const did = decodeURIComponent(params.did);
        const { network = 'mainnet' } = query;
        
        console.log(`[DID Router] Resolving DID: ${did} on network: ${network}`);
        
        const didService = new BtcoDidResolutionService();
        return await didService.resolve(did);
    }, {
        detail: {
            summary: 'Resolve DID',
            description: 'Resolves a DID to its DID document according to the BTCO DID Method Specification',
            tags: ['DID'],
            params: {
                did: 'The DID to resolve (e.g., did:btco:12345 or did:btco:sig:67890)'
            },
            query: {
                network: 'The Bitcoin network (mainnet, testnet, signet). Defaults to mainnet.'
            }
        }
    })
    .get('/:did/resources', async ({ params, query }) => {
        // Decode the URL-encoded DID parameter
        const did = decodeURIComponent(params.did);
        const { network = 'mainnet' } = query;
        
        console.log(`[DID Router] Getting resources for DID: ${did} on network: ${network}`);
        
        try {
            // Get the appropriate provider for the network
            const provider = getProvider(network as string);
            if (!provider) {
                return {
                    status: 'error',
                    message: `No provider available for network: ${network}`,
                    data: null
                };
            }

            // Resolve collection/resources for the DID
            const resources = await provider.resolveCollection(did, {
                limit: 50 // Default limit, could be parameterized
            });

            return {
                status: 'success',
                data: {
                    resources,
                    count: resources.length
                }
            };
        } catch (error) {
            console.error(`[DID Router] Error getting resources for DID ${did}:`, error);
            return {
                status: 'error',
                message: error instanceof Error ? error.message : 'Unknown error occurred',
                data: null
            };
        }
    }, {
        detail: {
            summary: 'Get DID Resources',
            description: 'Gets all resources/inscriptions associated with a DID',
            tags: ['DID'],
            params: {
                did: 'The DID to get resources for'
            },
            query: {
                network: 'The Bitcoin network (mainnet, testnet, signet). Defaults to mainnet.'
            }
        }
    }); 