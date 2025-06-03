/**
 * CBOR (Concise Binary Object Representation) utilities for encoding and decoding data
 * Used for handling DID Documents and other metadata in BTCO DIDs
 * 
 * This implementation uses the 'cbor-js' library for proper CBOR encoding/decoding
 * as required by the Ordinals Plus specification. cbor-js is a pure JavaScript
 * implementation that works well in both Node.js and browser environments.
 */

import * as CBOR from 'cbor-js';

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
 * @param data - The CBOR data to decode
 * @returns The decoded JavaScript object
 */
export function decodeCbor(data: Uint8Array): unknown {
  try {
    // cbor-js expects ArrayBuffer, so convert from Uint8Array properly
    // Create a new ArrayBuffer to avoid SharedArrayBuffer issues
    const arrayBuffer = new ArrayBuffer(data.length);
    const uint8View = new Uint8Array(arrayBuffer);
    uint8View.set(data);
    
    // Decode CBOR data
    return CBOR.decode(arrayBuffer);
  } catch (error) {
    console.error('Error decoding CBOR data:', error);
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
  if (data.length === 0) return false;
  
  try {
    // Try to decode the data as CBOR
    // If it succeeds, it's likely valid CBOR
    decodeCbor(data);
    return true;
  } catch {
    // If decoding fails, it's probably not CBOR
    return false;
  }
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
    return decodeCbor(metadata);
  } catch (error) {
    console.error('Error extracting CBOR metadata:', error);
    return null;
  }
}