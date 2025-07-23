/**
 * Type definitions for cbor-js
 * A pure JavaScript CBOR encoder/decoder library
 */

declare module 'cbor-js' {
  /**
   * Encodes a JavaScript value to CBOR format
   * @param value - The value to encode
   * @returns ArrayBuffer containing the CBOR-encoded data
   */
  export function encode(value: any): ArrayBuffer;

  /**
   * Decodes CBOR data back to a JavaScript value
   * @param buffer - ArrayBuffer containing CBOR data
   * @returns The decoded JavaScript value
   */
  export function decode(buffer: ArrayBuffer): any;
} 