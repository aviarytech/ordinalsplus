/**
 * CBOR (Concise Binary Object Representation) utilities for encoding and decoding data
 * Used for handling DID Documents and other metadata in BTCO DIDs
 * 
 * This implementation uses the 'cbor-js' library for proper CBOR encoding/decoding
 * as required by the Ordinals Plus specification. cbor-js is a pure JavaScript
 * implementation that works well in both Node.js and browser environments.
 */

import CBOR from 'cbor-js';

/**
 * Converts a hex string to Uint8Array
 * 
 * @param hexString - The hex string to convert (with or without 0x prefix)
 * @returns The corresponding Uint8Array
 */
function hexToUint8Array(hexString: string): Uint8Array {
  const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
  const bytes = new Uint8Array(cleanHex.length / 2);
  
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
  }
  
  return bytes;
}

/**
 * Converts a Uint8Array to hex string
 * 
 * @param bytes - The Uint8Array to convert
 * @returns The corresponding hex string
 */
function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Encodes a JavaScript object to CBOR format
 * 
 * @param obj - The object to encode
 * @returns The encoded data as a Uint8Array
 */
export function encodeCbor(obj: unknown): Uint8Array {
  try {
    // Use cbor-js encode function
    const cborBuffer = CBOR.encode(obj);
    
    // cbor-js returns ArrayBuffer, convert to Uint8Array for consistency
    return new Uint8Array(cborBuffer);
  } catch (error) {
    console.error('Error encoding CBOR data:', error);
    throw new Error(`Failed to encode object as CBOR: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decodes CBOR data to a JavaScript object
 * 
 * @param data - The hex encoded CBOR data to decode
 * @returns The decoded JavaScript object
 */
export function decodeCbor(data: string): unknown {
  try {
    // Convert hex string to ArrayBuffer
    const bytes = hexToUint8Array(data);
    
    // Convert Uint8Array to ArrayBuffer for CBOR.decode()
    const arrayBuffer = new ArrayBuffer(bytes.length);
    const view = new Uint8Array(arrayBuffer);
    view.set(bytes);
    
    return CBOR.decode(arrayBuffer);
  } catch (error) {
    console.error('Error decoding CBOR data:', error);
    throw new Error(`Failed to decode CBOR data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Checks if data appears to be CBOR encoded
 * 
 * @param data - The data to check (as Uint8Array)
 * @returns True if the data appears to be CBOR encoded
 */
export function isCbor(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  
  try {
    // Convert Uint8Array to hex string for decodeCbor
    const hexString = uint8ArrayToHex(data);
    
    // Try to decode the data as CBOR
    // If it succeeds, it's likely valid CBOR
    decodeCbor(hexString);
    return true;
  } catch {
    // If decoding fails, it's probably not CBOR
    return false;
  }
}

/**
 * Extracts CBOR encoded metadata from an Ordinals inscription
 * 
 * @param metadata - The raw metadata from the inscription (as Uint8Array)
 * @returns The decoded JavaScript object or null if invalid
 */
export function extractCborMetadata(metadata: Uint8Array | null): unknown | null {
  if (!metadata || metadata.length === 0) {
    return null;
  }
  
  try {
    // Convert Uint8Array to hex string for decodeCbor
    const hexString = uint8ArrayToHex(metadata);
    
    return decodeCbor(hexString);
  } catch (error) {
    console.error('Error extracting CBOR metadata:', error);
    return null;
  }
}