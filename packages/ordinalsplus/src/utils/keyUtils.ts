import { ed25519 } from '@noble/curves/ed25519';

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
