import { DID, Inscription } from '../types';

// DID Prefix for Bitcoin Ordinals
const DID_BTCO_PREFIX = 'did:btco:';

/**
 * Checks if the given string is a valid BTCO DID
 */
export const isValidBtcoDid = (didString: string): boolean => {
  if (!didString.startsWith(DID_BTCO_PREFIX)) {
    return false;
  }
  
  // Extract the identifier part after the prefix
  const identifier = didString.substring(DID_BTCO_PREFIX.length);
  
  // Basic validation: ensure the identifier is not empty and has a reasonable length
  return identifier.length > 0 && identifier.length <= 64;
};

/**
 * Extract DID information from an inscription
 */
export const extractDidFromInscription = (inscription: Inscription): DID | null => {
  try {
    // Skip non-JSON content
    if (!inscription.content_type.includes('application/json')) {
      return null;
    }
    
    // Parse the content as JSON
    const content = JSON.parse(inscription.content);
    
    // Check if this content contains a DID id field
    if (!content.id || typeof content.id !== 'string' || !isValidBtcoDid(content.id)) {
      return null;
    }
    
    return {
      id: content.id,
      inscriptionId: inscription.id,
      contentType: inscription.content_type,
      content
    };
  } catch (error) {
    console.error('Error extracting DID from inscription:', error);
    return null;
  }
};

/**
 * Function to extract DIDs from a list of inscriptions
 */
export const extractDidsFromInscriptions = (inscriptions: Inscription[]): DID[] => {
  const dids: DID[] = [];
  
  for (const inscription of inscriptions) {
    const did = extractDidFromInscription(inscription);
    if (did) {
      dids.push(did);
    }
  }
  
  return dids;
};

/**
 * Function to search for DID-related inscriptions using regex
 */
export const buildDidSearchQuery = (): string => {
  return DID_BTCO_PREFIX;
};
