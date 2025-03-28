import { BTCO_METHOD } from './constants';
import { Inscription, SatInscription, SatOrdinalInscription } from '../types';

/**
 * The maximum sat number allowed by the Bitcoin network
 * 2099999997690000 satoshis = 21 million BTC
 */
const MAX_SAT_NUMBER = 2099999997690000;

/**
 * Regular expression for a valid BTCO DID
 * Format: did:btco:satNumber[/<inscriptionIndex>]
 * Examples:
 * - did:btco:1234567890
 * - did:btco:1234567890/0
 * - did:btco:1234567890/42
 */
const BTCO_DID_REGEX = /^did:btco:(\d+)(?:\/(\d+))?$/;

/**
 * Regular expression for a valid resource identifier
 * Format: did:btco:satNumber[/<inscriptionIndex>]
 */
const RESOURCE_ID_REGEX = /^(did:btco:\d+(?:\/\d+)?)$/;

/**
 * Validates if a string is a valid BTCO DID
 */
export function isValidBtcoDid(didString: string): boolean {
  if (!didString) return false;
  
  const match = BTCO_DID_REGEX.exec(didString);
  if (!match) return false;
  
  // Check if this is a valid sat number (non-negative integer within range)
  const satNumber = Number(match[1]);
  if (isNaN(satNumber) || !Number.isInteger(satNumber) || satNumber < 0 || satNumber > MAX_SAT_NUMBER) {
    return false;
  }
  
  // If inscription index is specified, validate it
  if (match[2] !== undefined) {
    const inscriptionIndex = Number(match[2]);
    if (isNaN(inscriptionIndex) || !Number.isInteger(inscriptionIndex) || inscriptionIndex < 0) {
      return false;
    }
  }
  
  return true;
}

/**
 * Parses a BTCO DID and extracts its components
 */
export function parseBtcoDid(didString: string): { method: string; satNumber: string; inscriptionIndex?: string } | null {
  if (!didString) return null;
  
  const match = BTCO_DID_REGEX.exec(didString);
  if (!match) return null;
  
  const satNumber = match[1];
  const inscriptionIndex = match[2] || undefined;
  
  // Check if this is a valid sat number
  if (Number(satNumber) < 0 || Number(satNumber) > MAX_SAT_NUMBER) {
    return null;
  }
  
  return {
    method: BTCO_METHOD,
    satNumber,
    inscriptionIndex
  };
}

/**
 * Validates if a string is a valid resource identifier
 */
export function isValidResourceId(resourceId: string): boolean {
  if (!resourceId) return false;
  return isValidBtcoDid(resourceId);
}

/**
 * Parses a resource identifier to extract its components
 */
export function parseResourceId(resourceId: string): { did: string } | null {
  if (!resourceId) return null;
  
  const match = RESOURCE_ID_REGEX.exec(resourceId);
  if (!match) return null;
  
  const didPart = match[1];
  
  if (!isValidBtcoDid(didPart)) {
    return null;
  }
  
  return {
    did: didPart
  };
}

/**
 * Creates a properly formatted resource ID from a sat number and index
 */
export function createResourceId(
  satNumber: string | number, 
  inscriptionIndex: string | number = 0
): string {
  const satStr = String(satNumber);
  const inscIndexStr = String(inscriptionIndex);
  return `did:btco:${satStr}/${inscIndexStr}`;
}

/**
 * Extracts the sat number from an inscription
 */
export function extractSatNumber(inscription: Inscription): string {
  if (isSatInscription(inscription)) {
    return String(inscription.sat);
  }
  
  if (isSatOrdinalInscription(inscription) && inscription.sat_ordinal) {
    const match = inscription.sat_ordinal.match(/(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    throw new Error('Could not extract sat number from sat_ordinal');
  }
  
  throw new Error('Sat information (sat or sat_ordinal) is required for DID creation');
}

/**
 * Type guard for SatInscription
 */
export function isSatInscription(inscription: Inscription): inscription is SatInscription {
  return 'sat' in inscription;
}

/**
 * Type guard for SatOrdinalInscription
 */
export function isSatOrdinalInscription(inscription: Inscription): inscription is SatOrdinalInscription {
  return 'sat_ordinal' in inscription;
}

/**
 * Creates a properly formatted DID from an inscription
 */
export function createDidFromInscriptionData(inscription: Inscription): string {
  const satNumber = extractSatNumber(inscription);
  const inscriptionIndex = inscription.number !== undefined ? Number(inscription.number) : 0;
  
  return `did:btco:${satNumber}/${inscriptionIndex}`;
}

export function createResourceIdFromInscription(inscription: Inscription): string {
  const satNumber = extractSatNumber(inscription);
  const inscriptionIndex = inscription.number || 0;
  return createResourceId(satNumber, inscriptionIndex);
} 