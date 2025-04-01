import { BTCO_METHOD } from '../utils/constants';
import { extractSatNumber, extractIndexFromInscription } from '../utils/validators';
import type { Inscription, LinkedResource } from '../types';

/**
 * Wraps content based on content type
 */
function wrapContent(content: any, contentType?: string): { value: any } {
    if (content === undefined || content === null) {
        return { value: null };
    }
    if (typeof content === 'object' && !Array.isArray(content)) {
        if ('value' in content) {
            return content;
        }
        return { value: content };
    }
    return { value: content };
}

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
export function createLinkedResourceFromInscription(inscription: Inscription, resourceType: string): LinkedResource {
    if (!inscription.id) {
        throw new Error('Inscription ID is required');
    }

    const satNumber = extractSatNumber(inscription);
    const index = extractIndexFromInscription(inscription);
    const resourceId = `did:btco:${satNumber}/${index}`;
    const didReference = `did:btco:${satNumber}`;

    return {
        id: resourceId,
        type: resourceType,
        inscriptionId: inscription.id,
        didReference,
        contentType: inscription.content_type || 'application/json',
        content: wrapContent(inscription.content, inscription.content_type),
        sat: satNumber
    };
}

/**
 * Checks if a string is a valid BTCO DID
 */
export function isBtcoDid(did: string): boolean {
    return did.startsWith(`did:${BTCO_METHOD}:`);
}