/**
 * Simple JSON-based utilities for encoding and decoding data
 * Used for handling DID Documents and other metadata in BTCO DIDs
 * 
 * This implementation uses JSON.stringify/parse with TextEncoder/Decoder
 * for maximum browser compatibility
 */

/**
 * Encodes a JavaScript object to binary format using JSON
 * 
 * @param obj - The object to encode
 * @returns The encoded data as a Uint8Array
 */
export function encodeCbor(obj: unknown): Uint8Array {
  try {
    // Convert object to JSON string
    const jsonString = JSON.stringify(obj);
    
    // Use TextEncoder for browser-compatible string to Uint8Array conversion
    const encoder = new TextEncoder();
    return encoder.encode(jsonString);
  } catch (error) {
    console.error('Error encoding data:', error);
    throw new Error(`Failed to encode object: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Decodes binary data to a JavaScript object using JSON
 * 
 * @param data - The binary data to decode
 * @returns The decoded JavaScript object
 */
export function decodeCbor(data: Uint8Array): unknown {
  try {
    // Use TextDecoder for browser-compatible Uint8Array to string conversion
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(data);
    
    // Parse JSON string to object
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error decoding data:', error);
    throw new Error(`Failed to decode binary data: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Checks if data appears to be JSON encoded
 * 
 * @param data - The data to check
 * @returns True if the data appears to be JSON encoded
 */
export function isCbor(data: Uint8Array): boolean {
  if (data.length === 0) return false;
  
  try {
    // Check for common JSON starting characters: {, [, ", number, true, false, null
    const firstChar = String.fromCharCode(data[0]);
    
    // Simple check for JSON-like data
    if (['{', '[', '"', 't', 'f', 'n'].includes(firstChar) || 
        (firstChar >= '0' && firstChar <= '9') || 
        firstChar === '-') {
      
      // Try to decode a small sample to verify it's valid JSON
      // This is more reliable than just checking the first character
      const decoder = new TextDecoder();
      const sample = decoder.decode(data.slice(0, Math.min(data.length, 50)));
      
      // Try to parse the beginning of the JSON to see if it's valid
      // This will throw an error if it's not valid JSON
      JSON.parse(sample.charAt(0) === '{' ? sample : `{"sample":${sample}}`);
      
      return true;
    }
    
    return false;
  } catch {
    return false;
  }
}

/**
 * Extracts JSON encoded metadata from an Ordinals inscription
 * 
 * @param metadata - The raw metadata from the inscription
 * @returns The decoded JavaScript object or null if invalid
 */
export function extractCborMetadata(metadata: Uint8Array | null): unknown | null {
  if (!metadata || metadata.length === 0) {
    return null;
  }
  
  try {
    // For backward compatibility, we'll try to decode the data regardless of format check
    return decodeCbor(metadata);
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return null;
  }
}