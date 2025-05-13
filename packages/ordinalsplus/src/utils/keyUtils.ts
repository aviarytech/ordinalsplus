import { ed25519 } from '@noble/curves/ed25519';
import { encode as encodeBase58btc } from 'bs58';

/**
 * Represents an Ed25519 key pair.
 */
export interface Ed25519KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Generates a new Ed25519 key pair using @noble/curves.
 *
 * @returns {Ed25519KeyPair} The generated public and private key.
 */
export function generateEd25519KeyPair(): Ed25519KeyPair {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = ed25519.getPublicKey(privateKey);
  return {
    publicKey: publicKey,
    secretKey: privateKey,
  };
}

/**
 * Converts an Ed25519 public key to a multibase (base58btc, prefix 'z') string.
 * This format is used for representing DIDs and cryptographic keys in W3C DID documents.
 *
 * The process involves:
 * 1. Prepending a multicodec prefix for Ed25519 public keys (0xed) to the raw public key.
 * 2. Encoding the prefixed key using base58btc.
 * 3. Prepending the multibase prefix 'z' for base58btc.
 *
 * @param {Uint8Array} publicKey - The Ed25519 public key.
 * @returns {string} The multibase encoded public key string (e.g., "z6Mk...").
 */
export function publicKeyToMultibase(publicKey: Uint8Array): string {
  // Multicodec prefix for Ed25519 public key: 0xed
  const multicodecPrefix = new Uint8Array([0xed]);
  const prefixedPublicKey = new Uint8Array(multicodecPrefix.length + publicKey.length);

  prefixedPublicKey.set(multicodecPrefix);
  prefixedPublicKey.set(publicKey, multicodecPrefix.length);

  // Encode the prefixed public key using base58btc
  const encoded = encodeBase58btc(prefixedPublicKey);

  return `z${encoded}`;
} 