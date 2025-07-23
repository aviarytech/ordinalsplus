import { BtcoDidResolver, type Inscription, type LinkedResource } from 'ordinalsplus';
import { 
  createLinkedResourceFromInscription as ordinalsPlusCreateLinkedResourceFromInscription,
  type BitcoinNetwork
} from 'ordinalsplus';

// DID Prefixes we want to look for
export const DID_BTCO_PREFIX = 'did:btco';
export const DID_PREFIX = 'did';

// Regular expression to match BTCO DIDs
// Format: did:btco:<sat>/<index> or did:btco:[network:]<sat>
export const DID_REGEX = /^did:btco(?::(test|sig))?:(\d+)(?:\/(\d+))?$/i;

/**
 * DID Service for DID-related operations
 */
export class DIDService {
  private resolver: BtcoDidResolver;

  constructor() {
    this.resolver = new BtcoDidResolver();
  }

  /**
   * Resolves a DID to any content type (auto-detection) - primary resolution method
   * 
   * @param did - The DID to resolve
   * @returns The resolved content and metadata
   */
  async resolveDID(did: string): Promise<{ didDocument?: any; content?: any; contentType?: string; error?: string }> {
    try {
      console.log(`[DIDService] Resolving DID (auto-detection): ${did}`);
      
      if (!isValidDid(did)) {
        return { error: `Invalid DID format: ${did}` };
      }
      
      // Use auto-detection as the primary resolution method
      const result = await this.resolver.resolveAnyContent(did, {
        acceptUntrusted: true,
        enableAudit: false
      });
      
      if (result.didResolutionMetadata.error) {
        return { 
          error: `Failed to resolve DID: ${result.didResolutionMetadata.message || 'Unknown error'}` 
        };
      }
      
      const contentType = result.didResolutionMetadata.resolvedContentType;
      
      if (contentType === 'did-document' && result.didDocument) {
        console.log(`[DIDService] Successfully resolved DID Document for: ${did}`);
        return {
          didDocument: result.didDocument,
          content: result.content,
          contentType: 'did-document'
        };
      } else if (result.content) {
        console.log(`[DIDService] Successfully resolved ${contentType} content for: ${did}`);
        return {
          content: result.content,
          contentType: contentType || 'unknown'
        };
      }
      
      return { error: 'No content found in DID' };
      
    } catch (error) {
      console.error(`[DIDService] Error resolving DID ${did}:`, error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error during DID resolution' 
      };
    }
  }

  /**
   * Resolves a DID specifically as a DID Document (for verification purposes)
   * 
   * @param did - The DID to resolve
   * @returns The resolved DID document or error
   */
  async resolveDidDocument(did: string): Promise<{ didDocument?: any; error?: string }> {
    try {
      console.log(`[DIDService] Resolving as DID Document: ${did}`);
      
      if (!isValidDid(did)) {
        return { error: `Invalid DID format: ${did}` };
      }
      
      // Try to resolve as a DID Document explicitly
      const result = await this.resolver.resolve(did, {
        contentType: 'did-document',
        acceptUntrusted: true,
        enableAudit: false
      });
      
      if (result.resolutionMetadata.error || !result.didDocument) {
        // If it doesn't contain a DID Document, try to auto-detect content type
        console.log(`[DIDService] DID does not contain DID Document, trying auto-detection for: ${did}`);
        
        const anyContentResult = await this.resolver.resolveAnyContent(did, {
          acceptUntrusted: true,
          enableAudit: false
        });
        
        if (anyContentResult.didResolutionMetadata.error) {
          return { 
            error: `Failed to resolve DID: ${anyContentResult.didResolutionMetadata.message || 'Unknown error'}` 
          };
        }
        
        // Inform caller about what type of content was found
        const contentType = anyContentResult.didResolutionMetadata.resolvedContentType || 'unknown';
        return { 
          error: `DID contains ${contentType} content, not a DID Document. Use resolveDID() for auto-detection.` 
        };
      }
      
      console.log(`[DIDService] Successfully resolved DID Document for: ${did}`);
      return {
        didDocument: result.didDocument
      };
      
    } catch (error) {
      console.error(`[DIDService] Error resolving DID Document ${did}:`, error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error during DID Document resolution' 
      };
    }
  }

  /**
   * Resolves a DID to any content type (auto-detection)
   * 
   * @param did - The DID to resolve
   * @returns The resolved content and metadata
   */
  async resolveAnyContent(did: string): Promise<{ content?: any; contentType?: string; error?: string }> {
    try {
      console.log(`[DIDService] Resolving any content for DID: ${did}`);
      
      if (!isValidDid(did)) {
        return { error: `Invalid DID format: ${did}` };
      }
      
      const result = await this.resolver.resolveAnyContent(did, {
        acceptUntrusted: true,
        enableAudit: false
      });
      
      if (result.didResolutionMetadata.error) {
        return { 
          error: `Failed to resolve DID: ${result.didResolutionMetadata.message || 'Unknown error'}` 
        };
      }
      
      const contentType = result.didResolutionMetadata.resolvedContentType;
      
      if (contentType === 'did-document' && result.didDocument) {
        return {
          content: result.didDocument,
          contentType: 'did-document'
        };
      } else if (result.content) {
        return {
          content: result.content,
          contentType: contentType || 'unknown'
        };
      }
      
      return { error: 'No content found in DID' };
      
    } catch (error) {
      console.error(`[DIDService] Error resolving content for DID ${did}:`, error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error during content resolution' 
      };
    }
  }

  /**
   * Resolves a DID to a Verifiable Credential
   * 
   * @param did - The DID to resolve
   * @returns The resolved credential or error
   */
  async resolveCredential(did: string): Promise<{ credential?: any; error?: string }> {
    try {
      console.log(`[DIDService] Resolving credential for DID: ${did}`);
      
      if (!isValidDid(did)) {
        return { error: `Invalid DID format: ${did}` };
      }
      
      const result = await this.resolver.resolveCredential(did, {
        acceptUntrusted: true,
        enableAudit: false
      });
      
      if (result.didResolutionMetadata.error || !result.content) {
        return { 
          error: `Failed to resolve credential: ${result.didResolutionMetadata.message || 'DID does not contain a verifiable credential'}` 
        };
      }
      
      console.log(`[DIDService] Successfully resolved credential for: ${did}`);
      return {
        credential: result.content
      };
      
    } catch (error) {
      console.error(`[DIDService] Error resolving credential for DID ${did}:`, error);
      return { 
        error: error instanceof Error ? error.message : 'Unknown error during credential resolution' 
      };
    }
  }
}

/**
 * Function to search for DID-related inscriptions using regex
 */
export const buildDidSearchQuery = (): string => {
  return DID_BTCO_PREFIX;
};

/**
 * Creates a proper BTCO DID from an inscription
 * 
 * @param inscription The inscription data
 * @returns A DID object with proper DID format
 */
export function createDidFromInscription(inscription: Inscription): null {
  // Use the ordinalsplus package to create the DID
  // return ordinalsPlusCreateDidFromInscription(inscription);
  return null;
}

/**
 * Creates a proper Linked Resource from an inscription
 * 
 * @param inscription The inscription data
 * @param type The resource type
 * @param network The Bitcoin network
 * @param didReference Optional DID reference
 * @returns A LinkedResource object with proper format
 */
export function createLinkedResourceFromInscription(
  inscription: Inscription, 
  type: string, 
  didReference?: string,
  network: BitcoinNetwork = 'mainnet'
): LinkedResource | null {
  try {
    console.log('here111')
    return ordinalsPlusCreateLinkedResourceFromInscription(inscription, type, network);
  } catch (error) {
    console.error('Error creating linked resource:', error);
    return null;
  }
}

/**
 * Validates a BTCO DID string
 * 
 * @param didString The DID string to validate
 * @returns True if the DID is valid
 */
export function isValidDid(didString: string): boolean {
  return DID_REGEX.test(didString);
}

/**
 * Extract inscription ID from a DID
 * 
 * @param didString The DID string (did:btco:<sat>/<index>)
 * @returns The inscription ID or undefined if invalid
 */
export function getInscriptionIdFromDid(didString: string): string | undefined {
  if (!isValidDid(didString)) return undefined;
  
  try {
    const match = didString.match(DID_REGEX);
    if (match && match[3]) {
      return `i${match[3]}`;
    }
    return undefined;
  } catch (error) {
    console.error('Error parsing DID:', error);
    return undefined;
  }
} 