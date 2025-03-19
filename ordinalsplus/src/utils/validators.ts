import { BTCO_METHOD } from './constants';

/**
 * The maximum sat number allowed by the Bitcoin network
 * 2099999997690000 satoshis = 21 million BTC
 */
const MAX_SAT_NUMBER = 2099999997690000;

/**
 * Regular expression for a valid BTCO DID
 * Format: did:btco:satNumber
 */
const BTCO_DID_REGEX = /^did:btco:(\d+)$/;

/**
 * Regular expression for a valid resource identifier
 * Format: did:btco:satNumber/index[/suffix]
 */
const RESOURCE_ID_REGEX = /^(did:btco:\d+)\/(\d+)(?:\/([a-zA-Z0-9_-]+))?$/;

/**
 * Validates if a string is a valid BTCO DID
 * @param didString - The string to validate
 * @returns True if the string is a valid BTCO DID, false otherwise
 */
export function isValidBtcoDid(didString: string): boolean {
  if (!didString) return false;
  
  const match = BTCO_DID_REGEX.exec(didString);
  if (!match) return false;
  
  // Check if this is a valid sat number (non-negative integer within range)
  const satNumber = Number(match[1]);
  return !isNaN(satNumber) && 
    Number.isInteger(satNumber) && 
    satNumber >= 0 && 
    satNumber <= MAX_SAT_NUMBER;
}

/**
 * Parses a BTCO DID and extracts its components
 * @param didString - The DID string to parse
 * @returns The parsed components or null if invalid
 */
export function parseBtcoDid(didString: string): { method: string; satNumber: string } | null {
  if (!didString) return null;
  
  const match = BTCO_DID_REGEX.exec(didString);
  if (!match) return null;
  
  const satNumber = match[1];
  
  // Check if this is a valid sat number
  if (Number(satNumber) < 0 || Number(satNumber) > MAX_SAT_NUMBER) {
    return null;
  }
  
  return {
    method: BTCO_METHOD,
    satNumber
  };
}

/**
 * Validates if a string is a valid resource identifier
 * @param resourceId - The string to validate
 * @returns True if the string is a valid resource identifier, false otherwise
 */
export function isValidResourceId(resourceId: string): boolean {
  if (!resourceId) return false;
  
  const match = RESOURCE_ID_REGEX.exec(resourceId);
  if (!match) return false;
  
  // Validate that the DID part is valid
  const didPart = match[1];
  return isValidBtcoDid(didPart);
}

/**
 * Parses a resource identifier to extract its components
 * @param resourceId - The resource identifier to parse
 * @returns The parsed components or null if invalid
 */
export function parseResourceId(resourceId: string): { did: string; index: string; suffix?: string } | null {
  if (!resourceId) return null;
  
  const match = RESOURCE_ID_REGEX.exec(resourceId);
  if (!match) return null;
  
  const didPart = match[1];
  
  // Validate that the DID part is valid
  if (!isValidBtcoDid(didPart)) {
    return null;
  }
  
  return {
    did: didPart,
    index: match[2],
    suffix: match[3]
  };
}

/**
 * Creates a properly formatted resource ID from a sat number and index
 * @param satNumber - The sat number
 * @param index - The resource index
 * @returns A properly formatted resource ID
 */
export function createResourceId(satNumber: string | number, index: string | number = 0): string {
  // Ensure satNumber and index are strings
  const satStr = String(satNumber);
  const indexStr = String(index);
  
  // Format the resource ID
  return `did:btco:${satStr}/${indexStr}`;
}

/**
 * Creates a properly formatted resource ID from an inscription object
 * @param inscription - The inscription object containing sat and number properties
 * @returns A properly formatted resource ID or undefined if sat is not available
 */
export function createResourceIdFromInscription(
  inscription: { sat?: string | number; id?: string; number?: string | number }
): string | undefined {
  if (!inscription.sat) return undefined;
  
  // Extract the output index from the inscription ID
  let outputIndex = 0;
  if (inscription.id) {
    // Inscription IDs are typically in the format: <txid>i<output_index>
    // For example: 03f1e19fc75918befd6ef53641f8ecce0c439f2948028621e910ffaeff9510d6i0
    const match = inscription.id.match(/^[0-9a-f]+i(\d+)$/);
    if (match && match[1]) {
      outputIndex = parseInt(match[1], 10);
    }
  } else if (inscription.number !== undefined) {
    // Fallback to number if id parsing fails
    outputIndex = Number(inscription.number);
  }
  
  return createResourceId(
    inscription.sat,
    outputIndex
  );
} 