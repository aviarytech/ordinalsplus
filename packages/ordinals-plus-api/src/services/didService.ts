import type { Inscription, LinkedResource } from '../../../ordinalsplus/src';
import { 
  createLinkedResourceFromInscription as ordinalsPlusCreateLinkedResourceFromInscription,
  type BitcoinNetwork
} from '../../../ordinalsplus/src';

// DID Prefixes we want to look for
export const DID_BTCO_PREFIX = 'did:btco';
export const DID_PREFIX = 'did';

// Regular expression to match BTCO DIDs
// Format: did:btco:<sat>/<index>
const DID_REGEX = /^did:btco:(\d+)\/(\d+)$/i;

/**
 * DID Service for DID-related operations
 */
export class DIDService {
  /**
   * Resolves a DID to a DID Document
   * 
   * @param did - The DID to resolve
   * @returns The resolved DID document or error
   */
  async resolveDID(did: string): Promise<{ didDocument?: any; error?: string }> {
    // For now, this is a mock implementation
    // In a real implementation, this would:
    // 1. Validate the DID format
    // 2. Determine the DID method
    // 3. Call the appropriate resolver for that method
    // 4. Return the resolved DID document or error
    
    if (!isValidDid(did)) {
      return { error: `Invalid DID format: ${did}` };
    }
    
    // Mock DID document for testing
    return {
      didDocument: {
        id: did,
        verificationMethod: [
          {
            id: `${did}#key-1`,
            type: 'Ed25519VerificationKey2020',
            controller: did,
            publicKeyMultibase: 'zH3C2AVvLMv6gmMNam3uVAjZpfkcJCwDwnZn6z3wXmqPV'
          }
        ],
        authentication: [`${did}#key-1`]
      }
    };
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
    if (match && match[2]) {
      return `i${match[2]}`;
    }
    return undefined;
  } catch (error) {
    console.error('Error parsing DID:', error);
    return undefined;
  }
} 