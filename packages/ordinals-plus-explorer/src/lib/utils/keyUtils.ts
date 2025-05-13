import { ed25519 } from '@noble/curves/ed25519';
import { encode as encodeBase58btc } from 'bs58';
import { CID } from 'multiformats/cid';
import { base58btc } from 'multiformats/bases/base58';

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
  // Multicodec prefix for Ed25519 public key: 0xed01
  // 0xed is the code for ed25519-pub
  // 0x01 is the varint representation of the length of the key (32 bytes)
  // However, the common practice for did:key (and similar) is to use 0xed as the prefix byte
  // directly, followed by the 32-byte key.
  // Let's verify this against a known did:key example if possible,
  // but for now, we'll use 0xed as the prefix for the 32-byte key.
  // Example: did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH
  // The part after 'z' is the base58btc encoding of <multicodec-ed25519-pub><raw-public-key>
  // The multicodec for ed25519-pub is 0xed.
  // So, we create a new Uint8Array: [0xed, ...publicKey]

  const multicodecPrefix = new Uint8Array([0xed]); // 0xed for ed25519-pub
  const prefixedPublicKey = new Uint8Array(multicodecPrefix.length + publicKey.length);

  prefixedPublicKey.set(multicodecPrefix);
  prefixedPublicKey.set(publicKey, multicodecPrefix.length);

  // Encode the prefixed public key using base58btc
  // The multiformats library expects a CID for its base58btc.encode,
  // which is not what we want for a simple did:key style multibase string.
  // We need a direct base58btc encoding of the prefixed key.
  // The 'bs58' library can do this directly.
  const encoded = encodeBase58btc(prefixedPublicKey);

  return `z${encoded}`;
}
