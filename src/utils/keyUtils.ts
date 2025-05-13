import { ed25519 } from '@noble/curves/ed25519';
import { randomBytes } from 'crypto';
import { base58btc } from 'multiformats/bases/base58';

/**
 * Represents an Ed25519 key pair.
 */
export interface Ed25519KeyPair {
  /**
   * The public key, hex-encoded (32 bytes).
   */
  publicKeyHex: string;
  /**
   * The private key (seed), hex-encoded (32 bytes).
   */
  privateKeyHex: string;
  /**
   * The public key in Uint8Array format (32 bytes).
   */
  publicKeyBytes: Uint8Array;
  /**
   * The private key (seed) in Uint8Array format (32 bytes).
   */
  privateKeyBytes: Uint8Array;
}

/**
 * Generates a new Ed25519 key pair synchronously.
 *
 * @returns {Ed25519KeyPair} The generated key pair.
 * @throws {Error} If there is an issue with key generation.
 *
 * @example
 * function generateAndLogKeyPair() {
 *   try {
 *     const keyPair = generateEd25519KeyPair();
 *     console.log('Public Key (Hex):', keyPair.publicKeyHex);
 *     console.log('Private Key (Hex):', keyPair.privateKeyHex);
 *   } catch (error) {
 *     console.error('Key generation failed:', error);
 *   }
 * }
 * generateAndLogKeyPair();
 */
export function generateEd25519KeyPair(): Ed25519KeyPair {
  try {
    // ed25519.utils.randomPrivateKey() generates a 32-byte cryptographically secure random private key (seed).
    const privateKeySeed: Uint8Array = ed25519.utils.randomPrivateKey();
    
    // ed25519.getPublicKey() derives the public key from the 32-byte private key seed.
    const publicKeyBytes: Uint8Array = ed25519.getPublicKey(privateKeySeed);

    return {
      publicKeyHex: Buffer.from(publicKeyBytes).toString('hex'),
      privateKeyHex: Buffer.from(privateKeySeed).toString('hex'),
      publicKeyBytes,
      privateKeyBytes: privateKeySeed, // Storing the 32-byte seed
    };
  } catch (error) {
    console.error('Error generating Ed25519 key pair:', error);
    // It's good practice to cast the error to Error type if unsure about its shape
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate Ed25519 key pair: ${message}`);
  }
}

/**
 * Converts a public key (Uint8Array) to a multibase (base58btc) string.
 * This format is commonly used for DIDs and other decentralized identifiers.
 * The multibase prefix for base58btc is 'z'.
 *
 * @param {Uint8Array} publicKeyBytes The public key to convert.
 * @returns {string} The multibase-encoded public key string.
 * @throws {Error} If the public key is invalid or conversion fails.
 *
 * @example
 * function convertPublicKey() {
 *   try {
 *     const keyPair = generateEd25519KeyPair();
 *     const multibaseKey = publicKeyToMultibase(keyPair.publicKeyBytes);
 *     console.log('Multibase Public Key:', multibaseKey);
 *   } catch (error) {
 *     console.error('Conversion failed:', error);
 *   }
 * }
 * convertPublicKey();
 */
export function publicKeyToMultibase(publicKeyBytes: Uint8Array): string {
  if (!publicKeyBytes || publicKeyBytes.length === 0) {
    throw new Error('Public key bytes cannot be empty.');
  }
  try {
    // The multibase prefix 'z' is for base58btc.
    // The multiformats library handles the prefixing automatically.
    return base58btc.encode(publicKeyBytes);
  } catch (error) {
    console.error('Error converting public key to multibase:', error);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to convert public key to multibase: ${message}`);
  }
} 