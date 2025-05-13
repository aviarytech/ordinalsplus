import { describe, it, expect } from 'bun:test';
import { generateEd25519KeyPair, publicKeyToMultibase, Ed25519KeyPair } from './keyUtils';

describe('keyUtils', () => {
  describe('generateEd25519KeyPair', () => {
    it('should generate a valid Ed25519 key pair', () => {
      const keyPair: Ed25519KeyPair = generateEd25519KeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.publicKeyHex).toBeTypeOf('string');
      expect(keyPair.publicKeyHex.length).toBe(64); // 32 bytes * 2 hex chars
      expect(keyPair.privateKeyHex).toBeTypeOf('string');
      expect(keyPair.privateKeyHex.length).toBe(64); // 32 bytes * 2 hex chars for the seed

      expect(keyPair.publicKeyBytes).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKeyBytes.length).toBe(32);
      expect(keyPair.privateKeyBytes).toBeInstanceOf(Uint8Array);
      expect(keyPair.privateKeyBytes.length).toBe(32);

      expect(Buffer.from(keyPair.privateKeyBytes).toString('hex')).toBe(keyPair.privateKeyHex);
      expect(Buffer.from(keyPair.publicKeyBytes).toString('hex')).toBe(keyPair.publicKeyHex);
    });

    it('should generate different key pairs on subsequent calls', () => {
      const keyPair1 = generateEd25519KeyPair();
      const keyPair2 = generateEd25519KeyPair();

      expect(keyPair1.publicKeyHex).not.toBe(keyPair2.publicKeyHex);
      expect(keyPair1.privateKeyHex).not.toBe(keyPair2.privateKeyHex);
    });
  });

  describe('publicKeyToMultibase', () => {
    it('should convert a valid public key to base58btc multibase format', () => {
      const keyPair = generateEd25519KeyPair();
      const multibaseKey = publicKeyToMultibase(keyPair.publicKeyBytes);

      expect(multibaseKey).toBeTypeOf('string');
      expect(multibaseKey.startsWith('z')).toBe(true);
      expect(multibaseKey.length).toBeGreaterThan(1);
    });

    it('should throw an error for empty public key bytes', () => {
      const emptyKey = new Uint8Array(0);
      expect(() => publicKeyToMultibase(emptyKey)).toThrow('Public key bytes cannot be empty.');
    });

    it('should throw an error for null public key bytes', () => {
      // @ts-expect-error testing invalid input
      expect(() => publicKeyToMultibase(null)).toThrow('Public key bytes cannot be empty.');
    });

    it('should throw an error for undefined public key bytes', () => {
      // @ts-expect-error testing invalid input
      expect(() => publicKeyToMultibase(undefined)).toThrow('Public key bytes cannot be empty.');
    });
  });
}); 