import { DID, Inscription, LinkedResource } from '../types';
import { createDidFromInscriptionData, extractSatNumber } from '../utils/validators';

/**
 * Creates a DID object from inscription data
 * 
 * @param inscription The inscription data
 * @returns A DID object with proper DID format
 */
export function createDidFromInscription(inscription: Inscription): DID {
  const inscriptionId = inscription.inscriptionId || inscription.id;
  if (!inscriptionId) {
    throw new Error('Inscription ID is required for DID creation');
  }
  
  const didString = createDidFromInscriptionData(inscription);
  const contentType = inscription.content_type || inscription.contentType || 'application/json';
  
  return {
    id: didString,
    inscriptionId,
    contentType,
    content: typeof inscription.content === 'object' && inscription.content !== null
      ? inscription.content as Record<string, unknown>
      : { id: didString }
  };
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
): LinkedResource {
  const inscriptionId = inscription.inscriptionId || inscription.id;
  if (!inscriptionId) {
    throw new Error('Inscription ID is required for resource creation');
  }
  
  const satNumber = extractSatNumber(inscription);
  if (!satNumber) {
    throw new Error('Sat number is required for resource creation');
  }
  
  const contentType = inscription.content_type || inscription.contentType || 'application/json';
  
  // Process the content based on its type
  let processedContent: Record<string, unknown>;
  if (typeof inscription.content === 'object' && inscription.content !== null) {
    processedContent = inscription.content as Record<string, unknown>;
  } else if (typeof inscription.content === 'string' && inscription.content.trim().startsWith('{')) {
    try {
      processedContent = JSON.parse(inscription.content);
    } catch (e) {
      processedContent = { value: inscription.content };
    }
  } else {
    processedContent = { value: inscription.content };
  }
  
  return {
    id: createDidFromInscriptionData(inscription),
    type,
    inscriptionId,
    didReference,
    contentType,
    content: processedContent,
    sat: String(satNumber)
  };
} 