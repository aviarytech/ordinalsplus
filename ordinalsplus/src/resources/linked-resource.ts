import { Inscription, LinkedResource } from '../types';
import { extractSatNumber, extractIndexFromInscription } from '../utils/validators';

/**
 * Creates a linked resource from an inscription
 * @param inscription The inscription to create the resource from
 * @param type The type of resource to create
 * @returns The created linked resource
 * @throws Error if the inscription is invalid or missing required data
 */
export function createLinkedResourceFromInscription(inscription: Inscription, type: string): LinkedResource {
  if (!inscription || !inscription.id) {
    throw new Error('Invalid inscription');
  }

  const satNumber = extractSatNumber(inscription);
  const index = extractIndexFromInscription(inscription);
  const didReference = `did:btco:${satNumber}`;
  const resourceId = `${didReference}/${index}`;
  const contentType = inscription.content_type || 'application/json';

  return {
    id: resourceId,
    type,
    inscriptionId: inscription.id,
    didReference,
    contentType,
    content_url: inscription.content_url || '',
    sat: satNumber
  };
} 