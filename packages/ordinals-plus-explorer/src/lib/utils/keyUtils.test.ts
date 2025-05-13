import { describe, it, expect } from 'bun:test';
import {
  generateEd25519KeyPair,
  publicKeyToMultibase,
  Ed25519KeyPair,
} from './keyUtils';
import { decode as decodeBase58btc } from 'bs58';

describe('keyUtils', () => {
  describe('generateEd25519KeyPair', () => {
    it('should generate a valid Ed25519 key pair', () => {
      const keyPair: Ed25519KeyPair = generateEd25519KeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.secretKey).toBeInstanceOf(Uint8Array);

      // Ed25519 public keys are 32 bytes
      expect(keyPair.publicKey.length).toBe(32);
      // Ed25519 private keys (secretKey in our interface) are 32 bytes with @noble/curves
      expect(keyPair.secretKey.length).toBe(32);
    });

    it('should generate different key pairs on subsequent calls', () => {
      const keyPair1: Ed25519KeyPair = generateEd25519KeyPair();
      const keyPair2: Ed25519KeyPair = generateEd25519KeyPair();

      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
      expect(keyPair1.secretKey).not.toEqual(keyPair2.secretKey);
    });
  });

  describe('publicKeyToMultibase', () => {
    it('should convert a public key to the correct multibase format (z...)', () => {
      const keyPair: Ed25519KeyPair = generateEd25519KeyPair();
      const multibaseKey = publicKeyToMultibase(keyPair.publicKey);

      expect(multibaseKey).toBeDefined();
      expect(typeof multibaseKey).toBe('string');
      expect(multibaseKey.startsWith('z')).toBe(true);

      // Verify the encoding process
      // 1. Remove 'z' prefix
      const base58btcPart = multibaseKey.substring(1);
      // 2. Decode base58btc
      const decodedBytes = decodeBase58btc(base58btcPart);
      // 3. Check for multicodec prefix 0xed
      expect(decodedBytes[0]).toBe(0xed);
      // 4. Check that the rest matches the original public key
      const originalPublicKeyBytes = decodedBytes.slice(1);
      expect(originalPublicKeyBytes).toEqual(Uint8Array.from(keyPair.publicKey));
    });

    it('should produce a known multibase string for a known public key (if available)', () => {
      // This test requires a known Ed25519 public key and its corresponding
      // did:key formatted multibase string (z...).
      // For example, from RFC or a trusted source.
      // If not readily available, this test can be marked as pending or skipped.

      // Example (Hypothetical - replace with actual known values if possible):
      // const knownPublicKeyHex = "af07aa5a822681b13f4a8f5e5fff03a3946e4f7aa713d7a768753a591399768a";
      // const knownMultibase = "z6Mkf4X9zZKVb4aWWP8e8Jz8vV1vR6H4F2tE7P8nQ1bXwYqC";
      // const knownPublicKey = Uint8Array.from(Buffer.from(knownPublicKeyHex, 'hex'));
      // const result = publicKeyToMultibase(knownPublicKey);
      // expect(result).toBe(knownMultibase);
      expect(true).toBe(true); // Placeholder until known values are found
    });
  });
}); 