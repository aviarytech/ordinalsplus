import { BTCO_METHOD } from '../utils/constants';
import { extractSatNumber, extractIndexFromInscription } from '../utils/validators';
import type { Inscription, LinkedResource } from '../types';

/**
 * Creates a DID from inscription data
 */
export function createDidFromInscriptionData(inscription: Inscription): string {
    const satNumber = extractSatNumber(inscription);
    return `did:btco:${satNumber}`;
}

/**
 * Creates a resource ID from inscription data
 */
export function createResourceIdFromInscription(inscription: Inscription): string {
    const satNumber = extractSatNumber(inscription);
    const index = extractIndexFromInscription(inscription);
    return `did:btco:${satNumber}/${index}`;
}

/**
 * Creates a linked resource from an inscription
 */
export function createLinkedResourceFromInscription(inscription: Inscription, type: string): LinkedResource {
    const satNumber = extractSatNumber(inscription);
    const index = extractIndexFromInscription(inscription);
    const resourceId = `did:btco:${satNumber}/${index}`;
    const didReference = `did:btco:${satNumber}`;

    return {
        id: resourceId,
        type,
        inscriptionId: inscription.id,
        didReference,
        contentType: inscription.content_type || 'application/json',
        content_url: inscription.content_url || '',
        sat: satNumber
    };
}

/**
 * Checks if a string is a valid BTCO DID
 */
export function isBtcoDid(did: string): boolean {
    return did.startsWith(`did:${BTCO_METHOD}:`);
}