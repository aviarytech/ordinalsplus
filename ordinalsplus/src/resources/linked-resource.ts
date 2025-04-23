import { Inscription, LinkedResource, BitcoinNetwork } from '../types';
import { extractSatNumber, extractIndexFromInscription } from '../utils/validators';
import { getDidPrefix } from '../did/did-utils';

/**
 * Creates a linked resource from an inscription
 * @param inscription The inscription to create the resource from
 * @param type The type of resource to create
 * @param network The Bitcoin network ('mainnet' or 'signet')
 * @returns The created linked resource
 * @throws Error if the inscription is invalid or missing required data, or if the network is unsupported
 */
export function createLinkedResourceFromInscription(inscription: Inscription, type: string, network: BitcoinNetwork): LinkedResource {
  if (!inscription || !inscription.id) {
    throw new Error('Invalid inscription');
  }

  const satNumber = extractSatNumber(inscription);
  const index = extractIndexFromInscription(inscription);
  const didPrefix = getDidPrefix(network);
  const didReference = `${didPrefix}:${satNumber}`;
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