import { BTCO_METHOD } from '../utils/constants';
import { extractSatNumber, extractIndexFromInscription } from '../utils/validators';
import type { Inscription, LinkedResource, ParsedResourceId, BitcoinNetwork } from '../types';

/**
 * Creates a DID from inscription data for a specific network.
 * @param inscription The inscription data.
 * @param network The Bitcoin network.
 * @returns The network-specific BTCO DID string.
 */
export function createDidFromInscriptionData(inscription: Inscription, network: BitcoinNetwork): string {
    const satNumber = extractSatNumber(inscription);
    const prefix = getDidPrefix(network);
    return `${prefix}:${satNumber}`;
}

/**
 * Creates a resource ID from inscription data for a specific network.
 * @param inscription The inscription data.
 * @param network The Bitcoin network.
 * @returns The network-specific resource ID string.
 */
export function createResourceIdFromInscription(inscription: Inscription, network: BitcoinNetwork): string {
    const satNumber = extractSatNumber(inscription);
    const index = extractIndexFromInscription(inscription);
    const prefix = getDidPrefix(network);
    // Construct didReference part first, then add index
    const didReference = `${prefix}:${satNumber}`;
    return `${didReference}/${index}`;
}

/**
 * Checks if a given string is a valid BTCO DID.
 * @param did The string to check.
 * @returns True if the string is a valid BTCO DID, false otherwise.
 */
export function isBtcoDid(did: string): boolean {
    return did.startsWith(`did:${BTCO_METHOD}:`);
}

/**
 * Returns the appropriate DID prefix based on the Bitcoin network.
 * @param network The Bitcoin network ('mainnet', 'signet', or 'testnet').
 * @returns The corresponding DID prefix string.
 * @throws Error if the network is unsupported.
 */
export function getDidPrefix(network: BitcoinNetwork): string {
    switch (network) {
        case 'mainnet':
            return 'did:btco';
        case 'signet':
            return 'did:btco:sig';
        case 'testnet':
            return 'did:btco:test';
        default:
            throw new Error(`Unsupported Bitcoin network: ${network}`);
    }
}