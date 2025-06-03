import { Inscription } from '../types';
import { BTCO_METHOD, ERROR_CODES, MAX_SAT_NUMBER } from './constants';

export interface ParsedResourceId {
    did: string;
    satNumber: string;
    index: number;
    network: string;
}

// Regular expressions for validation
const VALID_BTCO_DID_REGEX = /^did:btco(?::(test|sig))?:([0-9]+)$/;
const VALID_RESOURCE_ID_REGEX = /^did:btco(?::(test|sig))?:([0-9]+)\/([0-9]+)$/;

/**
 * Validates if a string is a valid BTCO DID
 * @param did The DID to validate
 * @returns true if the DID is valid
 */
export function isValidBtcoDid(did: string): boolean {
    const match = VALID_BTCO_DID_REGEX.exec(did);
    if (!match) return false;
    
    const satNumber = BigInt(match[2]);
    return satNumber <= BigInt(MAX_SAT_NUMBER);
}

/**
 * Validates if a string is a valid resource ID
 * @param id The resource ID to validate
 * @returns true if the resource ID is valid
 */
export function isValidResourceId(id: string): boolean {
    const match = VALID_RESOURCE_ID_REGEX.exec(id);
    if (!match) return false;
    
    const satNumber = BigInt(match[2]);
    if (satNumber > BigInt(MAX_SAT_NUMBER)) return false;
    
    const index = parseInt(match[3], 10);
    return index >= 0;
}

/**
 * Parses a BTCO DID into its components
 * @param did The DID to parse
 * @returns The parsed components or null if invalid
 */
export function parseBtcoDid(did: string): { did: string; satNumber: string; network: string } | null {
    const match = VALID_BTCO_DID_REGEX.exec(did);
    if (!match) return null;
    
    const networkSuffix = match[1];
    const satNumber = match[2];
    const network = networkSuffix || 'mainnet';
    
    if (BigInt(satNumber) > BigInt(MAX_SAT_NUMBER)) return null;
    
    return {
        did,
        satNumber,
        network
    };
}

/**
 * Parses a resource ID into its components
 * @param id The resource ID to parse
 * @returns The parsed components or null if invalid
 */
export function parseResourceId(id: string): { did: string; satNumber: string; index: number; network: string } | null {
    const match = VALID_RESOURCE_ID_REGEX.exec(id);
    if (!match) return null;
    
    const networkSuffix = match[1];
    const satNumber = match[2];
    const index = parseInt(match[3], 10);
    const network = networkSuffix || 'mainnet';
    
    if (BigInt(satNumber) > BigInt(MAX_SAT_NUMBER)) return null;
    if (index < 0) return null;
    
    const didPrefix = networkSuffix ? `did:btco:${networkSuffix}` : 'did:btco';
    
    return {
        did: `${didPrefix}:${satNumber}`,
        satNumber,
        index,
        network
    };
}

/**
 * Type guard for SatInscription
 */
export function isSatInscription(inscription: Inscription): inscription is Inscription {
  return 'sat' in inscription;
}

function isValidSatNumber(satNumber: string): boolean {
  const num = parseInt(satNumber, 10);
  return !isNaN(num) && num >= 0 && num <= MAX_SAT_NUMBER;
}

function isValidIndex(index: string): boolean {
  const num = parseInt(index, 10);
  return !isNaN(num) && num >= 0;
}

/**
 * Extracts the sat number from an inscription
 * @param inscription The inscription to extract from
 * @returns The sat number
 * @throws Error if no valid sat number is found
 */
export function extractSatNumber(inscription: Inscription): number {
    if (!inscription.sat) {
        throw new Error('Sat number is required');
    }
    
    const satNumber = typeof inscription.sat === 'string' ? inscription.sat : inscription.sat.toString();
    if (!isValidSatNumber(satNumber)) {
        throw new Error('Invalid sat number');
    }
    
    return parseInt(satNumber, 10);
}

/**
 * Extracts the index from an inscription
 * @param inscription The inscription to extract from
 * @returns The index
 * @throws Error if no valid index is found
 */
export function extractIndexFromInscription(inscription: Inscription): number {
    if (!inscription || !inscription.id) {
        throw new Error('Invalid inscription');
    }
    
    // First try to get index from inscription ID
    const idMatch = /i([0-9]+)$/.exec(inscription.id);
    if (idMatch) {
        const index = parseInt(idMatch[1], 10);
        if (!isNaN(index) && index >= 0) {
            return index;
        }
    }
    
    // Fallback to number property
    if (typeof inscription.number === 'number' && inscription.number >= 0) {
        return inscription.number;
    }
    
    throw new Error('No valid index found in inscription');
} 