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
   * Unified DID resolution method
   * 
   * @param did - The DID to resolve
   * @param options.expectedContent - Desired content type: 'any' | 'did-document' | 'credential'
   * @returns The resolved content and metadata
   */
  async resolve(
    did: string,
    options: { expectedContent?: 'any' | 'did-document' | 'credential' } = { expectedContent: 'any' }
  ): Promise<{ didDocument?: any; content?: any; contentType?: string; error?: string }> {
    const { expectedContent = 'any' } = options;
    try {
      console.log(`[DIDService] Resolving DID (${expectedContent}) for: ${did}`);
      
      if (!isValidDid(did)) {
        return { error: `Invalid DID format: ${did}` };
      }
      
      // Use core resolver to fetch inscriptions and an optional DID Document
      const resolution = await this.resolver.resolve(did);
      
      if (resolution.resolutionMetadata?.error) {
        return { error: `Failed to resolve DID: ${resolution.resolutionMetadata.message || resolution.resolutionMetadata.error}` };
      }
      
      // Helper to attempt extracting a Verifiable Credential from inscriptions
      const tryExtractCredential = (): any | null => {
        const inscriptions = resolution.inscriptions || [];
        for (const ins of inscriptions) {
          const text = ins.content;
          if (!text) continue;
          try {
            const parsed = JSON.parse(text);
            const hasVcContext = Array.isArray(parsed['@context'])
              ? parsed['@context'].some((c: string) => typeof c === 'string' && c.includes('credentials'))
              : typeof parsed['@context'] === 'string' && parsed['@context'].includes('credentials');
            const isVcType = Array.isArray(parsed.type)
              ? parsed.type.includes('VerifiableCredential')
              : parsed.type === 'VerifiableCredential';
            if (hasVcContext || isVcType) {
              return parsed;
            }
          } catch (_) {
            // not JSON or not a VC; continue
          }
        }
        return null;
      };
      
      // 1) If DID Document is requested or available and acceptable
      if (expectedContent === 'did-document') {
        if (resolution.didDocument) {
          return { didDocument: resolution.didDocument, contentType: 'did-document' };
        }
        // Report what else we found
        const vc = tryExtractCredential();
        if (vc) {
          return { error: 'DID contains a verifiable credential, not a DID Document. Use expectedContent: \u2018credential\u2019 or \u2018any\u2019.' };
        }
        const first = (resolution.inscriptions || [])[0];
        const foundType = first?.contentType || 'unknown';
        return { error: `DID does not contain a DID Document. Found content type: ${foundType}` };
      }
      
      // 2) If credential requested
      if (expectedContent === 'credential') {
        const vc = tryExtractCredential();
        if (vc) {
          return { content: vc, contentType: 'credential' };
        }
        if (resolution.didDocument) {
          return { error: 'DID contains a DID Document, not a verifiable credential. Use expectedContent: \u2018did-document\u2019 or \u2018any\u2019.' };
        }
        const first = (resolution.inscriptions || [])[0];
        const foundType = first?.contentType || 'unknown';
        return { error: `No verifiable credential found. Found content type: ${foundType}` };
      }
      
      // 3) Auto-detect: prefer DID Document, then Credential, else first inscription
      if (resolution.didDocument) {
        return { didDocument: resolution.didDocument, contentType: 'did-document' };
      }
      const vc = tryExtractCredential();
      if (vc) {
        return { content: vc, contentType: 'credential' };
      }
      const first = (resolution.inscriptions || [])[0];
      if (first && first.content) {
        return { content: first.content, contentType: first.contentType || 'unknown' };
      }
      
      return { error: 'No content found in DID' };
      
    } catch (error) {
      console.error(`[DIDService] Error resolving DID ${did}:`, error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error during DID resolution'
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