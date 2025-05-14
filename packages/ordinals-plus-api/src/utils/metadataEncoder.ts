import { encode } from 'cbor';

/**
 * Interface for the input to the Ordinals Plus metadata encoding function.
 */
export interface OrdinalsPlusMetadataInput {
  /** The DID Document, typically a parsed JSON object. */
  didDocument: object;
  /** The Verifiable Credential, can be a parsed JSON object or a JWT string. */
  verifiableCredential: object | string;
}

/**
 * Encodes the Ordinals Plus metadata (DID Document and Verifiable Credential)
 * into a CBOR-formatted Buffer.
 *
 * The internal structure of the CBOR payload is a map with two keys:
 * - `didDocument`: The value is the DID Document.
 * - `verifiableCredential`: The value is the Verifiable Credential.
 *
 * @param metadata - An object conforming to the OrdinalsPlusMetadataInput interface.
 * @returns A Buffer containing the CBOR-encoded metadata.
 * @throws Error if CBOR encoding fails.
 */
export function encodeOrdinalsPlusMetadata(metadata: OrdinalsPlusMetadataInput): Buffer {
  if (!metadata || typeof metadata !== 'object') {
    throw new Error('Invalid metadata input: must be an object.');
  }
  if (typeof metadata.didDocument !== 'object' || metadata.didDocument === null) {
    throw new Error('Invalid didDocument: must be an object.');
  }
  if (typeof metadata.verifiableCredential !== 'object' && typeof metadata.verifiableCredential !== 'string') {
    throw new Error('Invalid verifiableCredential: must be an object or a string.');
  }
  if (typeof metadata.verifiableCredential === 'string' && metadata.verifiableCredential.trim() === '') {
    throw new Error('Invalid verifiableCredential: cannot be an empty string.');
  }
  if (typeof metadata.verifiableCredential === 'object' && metadata.verifiableCredential === null) {
    throw new Error('Invalid verifiableCredential: cannot be null if an object.');
  }

  const payload = {
    didDocument: metadata.didDocument,
    verifiableCredential: metadata.verifiableCredential,
  };

  try {
    return encode(payload);
  } catch (error) {
    console.error('Failed to encode metadata to CBOR:', error);
    // Propagate a more specific error or the original error depending on desired error handling strategy
    throw new Error(`CBOR encoding failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Estimates the size in bytes of the CBOR-encoded metadata.
 *
 * @param metadata - An object conforming to the OrdinalsPlusMetadataInput interface.
 * @returns The size in bytes of the resulting CBOR buffer.
 * @throws Error if metadata is invalid or if CBOR encoding fails (though less likely for size estimation).
 */
export function getEncodedMetadataSize(metadata: OrdinalsPlusMetadataInput): number {
  // This will perform the full encoding to get the length.
  // For very performance-sensitive scenarios where metadata is extremely large and this is called frequently,
  // one might consider a more direct size estimation if the CBOR library or spec allows, but for most
  // use cases, encoding to get length is acceptable and accurate.
  return encodeOrdinalsPlusMetadata(metadata).length;
} 