/**
 * CBOR (Concise Binary Object Representation) utilities for encoding and decoding CBOR data
 * Used for handling DID Documents and other metadata in BTCO DIDs
 */

import * as cbor from 'cbor';

/**
 * Encodes a JavaScript object to CBOR format
 * 
 * @param obj - The object to encode
 * @returns The CBOR encoded data as a Uint8Array
 */
export function encodeCbor(obj: unknown): Uint8Array {
  try {
    return cbor.encode(obj);
  } catch (error) {
    console.error('Error encoding CBOR:', error);
    throw new Error(`Failed to encode object to CBOR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decodes CBOR data to a JavaScript object
 * 
 * @param data - The CBOR data to decode
 * @returns The decoded JavaScript object
 */
export function decodeCbor(data: Uint8Array): unknown {
  try {
    return cbor.decode(data);
  } catch (error) {
    console.error('Error decoding CBOR:', error);
    throw new Error(`Failed to decode CBOR data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Checks if data appears to be CBOR encoded
 * 
 * @param data - The data to check
 * @returns True if the data appears to be CBOR encoded
 */
export function isCbor(data: Uint8Array): boolean {
  // A very basic check: CBOR data typically starts with a specific major type indicator
  // This is not foolproof but can give a hint
  if (data.length === 0) return false;
  
  // Check the first byte for valid CBOR major type
  const firstByte = data[0];
  const majorType = firstByte >> 5;
  
  // Major types 0-7 are valid in CBOR
  return majorType >= 0 && majorType <= 7;
}

/**
 * Extracts CBOR encoded metadata from an Ordinals inscription
 * 
 * @param metadata - The raw metadata from the inscription
 * @returns The decoded JavaScript object or null if invalid
 */
export function extractCborMetadata(metadata: Uint8Array | null): unknown | null {
  if (!metadata || metadata.length === 0) {
    return null;
  }
  
  try {
    if (isCbor(metadata)) {
      return decodeCbor(metadata);
    }
    return null;
  } catch (error) {
    console.error('Failed to extract CBOR metadata:', error);
    return null;
  }
} 