import type { DID, LinkedResource, Inscription } from '../types';
import { 
  createLinkedResourceFromInscription as ordinalsPlusCreateLinkedResourceFromInscription
} from 'ordinalsplus';

// DID Prefixes we want to look for
export const DID_BTCO_PREFIX = 'did:btco';
export const DID_PREFIX = 'did';

// Regular expression to match BTCO DIDs
// Format: did:btco:<sat>/<index>
const DID_REGEX = /^did:btco:(\d+)\/(\d+)$/i;

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
export function createDidFromInscription(inscription: Inscription): DID {
  // Use the ordinalsplus package to create the DID
  // return ordinalsPlusCreateDidFromInscription(inscription);
}

/**
 * Creates a proper Linked Resource from an inscription
 * 
 * @param inscription The inscription data
 * @param type The resource type
 * @param didReference Optional DID reference
 * @returns A LinkedResource object with proper format
 */
export function createLinkedResourceFromInscription(
  inscription: Inscription, 
  type: string, 
  didReference?: string
): LinkedResource | null {
  try {
    return ordinalsPlusCreateLinkedResourceFromInscription(inscription, type);
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