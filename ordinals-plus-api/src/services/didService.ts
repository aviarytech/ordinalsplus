import type { DID, Inscription } from '../types';

// DID Prefixes we want to look for
const DID_PREFIXES = ['did:btco:'];

/**
 * Checks if the given string is a valid DID
 */
export const isValidDid = (didString: string): boolean => {
  // Check if the string starts with any of our known DID prefixes
  const hasValidPrefix = DID_PREFIXES.some(prefix => didString.startsWith(prefix));
  
  if (!hasValidPrefix) {
    return false;
  }
  
  // Basic validation: ensure the identifier has a reasonable length
  return didString.length > 5 && didString.length <= 255;
};

/**
 * Extract DID information from an inscription
 * This function now handles both JSON and text content
 */
export const extractDidFromInscription = (inscription: Inscription): DID | null => {
  try {
    if (!inscription.content_type) {
      return null;
    }
    
    let content: Record<string, unknown>;
    
    // For JSON content, try to parse and extract the DID
    if (inscription.content_type.includes('application/json')) {
      try {
        content = JSON.parse(inscription.content);
        
        // Check if this content contains a DID id field
        if (content.id && typeof content.id === 'string') {
          // Check if the id is a valid DID
          const didId = content.id as string;
          if (isValidDid(didId)) {
            return {
              id: didId,
              inscriptionId: inscription.id,
              contentType: inscription.content_type,
              content
            };
          }
        }
      } catch (e) {
        console.log(`Failed to parse JSON from inscription ${inscription.id}`);
      }
    }
    
    // For non-JSON content, look for DID patterns in the content
    if (inscription.content && typeof inscription.content === 'string') {
      // Extract any DID pattern from the content
      const didMatch = inscription.content.match(/did:[a-zA-Z0-9]+:[a-zA-Z0-9.%-]+/);
      if (didMatch && didMatch[0]) {
        const didId = didMatch[0];
        if (isValidDid(didId)) {
          // Create a synthetic content object
          content = {
            id: didId,
            content: inscription.content
          };
          
          return {
            id: didId,
            inscriptionId: inscription.id,
            contentType: inscription.content_type,
            content
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting DID from inscription:', error);
    return null;
  }
};

/**
 * Function to extract DIDs from a list of inscriptions
 */
export const extractDidsFromInscriptions = (inscriptions: Inscription[]): DID[] => {
  console.log(`Extracting DIDs from ${inscriptions.length} inscriptions`);
  const dids: DID[] = [];
  
  for (const inscription of inscriptions) {
    const did = extractDidFromInscription(inscription);
    if (did) {
      dids.push(did);
    }
  }
  
  console.log(`Successfully extracted ${dids.length} valid DIDs`);
  return dids;
};

/**
 * Function to build a generic query string for DID-related inscriptions
 * This is kept for compatibility but not used for actual filtering
 */
export const buildDidSearchQuery = (): string => {
  return '';
}; 