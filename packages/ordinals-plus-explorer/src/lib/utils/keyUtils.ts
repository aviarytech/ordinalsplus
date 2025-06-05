import { ed25519 } from '@noble/curves/ed25519';
import { encoding } from 'ordinalsplus';

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
 * This is commonly used for representing DIDs and cryptographic keys in decentralized systems.
 *
 * The process involves:
 * 1. Prepending a multicodec prefix for Ed25519 public keys (0xed01) to the raw public key.
 * 2. Encoding the prefixed key using base58btc.
 * 3. Prepending the multibase prefix 'z' for base58btc.
 *
 * Note: While multiformats library provides CID for such operations,
 * for DID key representation, often a simpler direct multibase encoding of the
 * multicodec-prefixed key is used, rather than creating a full CID.
 * Here, we follow the common DID pattern.
 *
 * @param {Uint8Array} publicKey - The Ed25519 public key.
 * @returns {string} The multibase encoded public key string (e.g., "zAbc...").
 */
export function publicKeyToMultibase(publicKey: Uint8Array): string {
  return encoding.multikey.encode(encoding.MULTICODEC_ED25519_PUB_HEADER, publicKey);
}

export function privateKeyToMultibase(privateKey: Uint8Array): string {
  return encoding.multikey.encode(encoding.MULTICODEC_ED25519_PRIV_HEADER, privateKey);
}
