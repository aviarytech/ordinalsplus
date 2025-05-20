/**
 * @module tests/key-management/key-manager.test
 * @description Tests for the KeyManager module
 */

import { expect, describe, test, beforeEach } from 'bun:test';
import { KeyManager } from '../../key-management/key-manager';
import { InMemoryKeyStorage } from '../../key-management/key-storage';
import { bytesToHex } from '@noble/hashes/utils';

describe('KeyManager', () => {
  let keyManager: KeyManager;

  beforeEach(() => {
    // Create a fresh KeyManager instance for each test
    keyManager = new KeyManager({
      storage: new InMemoryKeyStorage()
    });
  });

  describe('Key Creation and Storage', () => {
    test('should create and store an Ed25519 key', async () => {
      const keyId = await keyManager.createKey({ type: 'Ed25519' });
      expect(keyId).toBeDefined();
      
      const key = await keyManager.getKey(keyId);
      expect(key).not.toBeNull();
      expect(key?.type).toBe('Ed25519');
      expect(key?.privateKey).toBeInstanceOf(Uint8Array);
      expect(key?.publicKey).toBeInstanceOf(Uint8Array);
    });

    test('should create and store a secp256k1 key', async () => {
      const keyId = await keyManager.createKey({ type: 'secp256k1' });
      expect(keyId).toBeDefined();
      
      const key = await keyManager.getKey(keyId);
      expect(key).not.toBeNull();
      expect(key?.type).toBe('secp256k1');
    });

    test('should create and store a schnorr key', async () => {
      const keyId = await keyManager.createKey({ type: 'schnorr' });
      expect(keyId).toBeDefined();
      
      const key = await keyManager.getKey(keyId);
      expect(key).not.toBeNull();
      expect(key?.type).toBe('schnorr');
    });

    test('should store keys with aliases', async () => {
      const alias = 'test-key';
      const keyId = await keyManager.createKey({ type: 'Ed25519' }, alias);
      
      const keyById = await keyManager.getKey(keyId);
      const keyByAlias = await keyManager.getKeyByAlias(alias);
      
      expect(keyById).not.toBeNull();
      expect(keyByAlias).not.toBeNull();
      expect(keyById).toEqual(keyByAlias);
    });

    test('should list all stored keys', async () => {
      await keyManager.createKey({ type: 'Ed25519' });
      await keyManager.createKey({ type: 'secp256k1' });
      await keyManager.createKey({ type: 'schnorr' });
      
      const keys = await keyManager.listKeys();
      expect(keys.length).toBe(3);
      
      // Check if we have one key of each type
      const types = keys.map(k => k.type);
      expect(types).toContain('Ed25519');
      expect(types).toContain('secp256k1');
      expect(types).toContain('schnorr');
    });

    test('should delete keys by ID', async () => {
      const keyId = await keyManager.createKey({ type: 'Ed25519' });
      expect(await keyManager.getKey(keyId)).not.toBeNull();
      
      const result = await keyManager.deleteKey(keyId);
      expect(result).toBe(true);
      expect(await keyManager.getKey(keyId)).toBeNull();
    });

    test('should delete keys by alias', async () => {
      const alias = 'test-delete';
      const keyId = await keyManager.createKey({ type: 'Ed25519' }, alias);
      expect(await keyManager.getKeyByAlias(alias)).not.toBeNull();
      
      const result = await keyManager.deleteKeyByAlias(alias);
      expect(result).toBe(true);
      expect(await keyManager.getKeyByAlias(alias)).toBeNull();
      expect(await keyManager.getKey(keyId)).toBeNull();
    });
  });

  describe('Key Import', () => {
    test('should import an Ed25519 private key', async () => {
      // Generate a random private key
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);
      
      const keyId = await keyManager.importKey(privateKey, 'Ed25519', 'imported-ed25519');
      expect(keyId).toBeDefined();
      
      const key = await keyManager.getKey(keyId);
      expect(key).not.toBeNull();
      expect(key?.type).toBe('Ed25519');
      expect(bytesToHex(key!.privateKey)).toBe(bytesToHex(privateKey));
    });

    test('should import a secp256k1 private key', async () => {
      // Generate a random private key
      const privateKey = new Uint8Array(32);
      crypto.getRandomValues(privateKey);
      
      const keyId = await keyManager.importKey(privateKey, 'secp256k1', 'imported-secp256k1');
      expect(keyId).toBeDefined();
      
      const key = await keyManager.getKey(keyId);
      expect(key).not.toBeNull();
      expect(key?.type).toBe('secp256k1');
      expect(bytesToHex(key!.privateKey)).toBe(bytesToHex(privateKey));
    });
  });

  describe('Signing and Verification', () => {
    test('should sign data with an Ed25519 key', async () => {
      const keyId = await keyManager.createKey({ type: 'Ed25519' });
      const data = new TextEncoder().encode('test data');
      
      const signature = await keyManager.sign(keyId, data);
      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBeGreaterThan(0);
      
      const isValid = await keyManager.verify(keyId, data, signature);
      expect(isValid).toBe(true);
    });

    test('should sign data with a secp256k1 key', async () => {
      const keyId = await keyManager.createKey({ type: 'secp256k1' });
      const data = new TextEncoder().encode('test data');
      
      const signature = await keyManager.sign(keyId, data);
      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBeGreaterThan(0);
      
      const isValid = await keyManager.verify(keyId, data, signature);
      expect(isValid).toBe(true);
    });

    test('should detect invalid signatures', async () => {
      const keyId = await keyManager.createKey({ type: 'Ed25519' });
      const data = new TextEncoder().encode('test data');
      const tamperedData = new TextEncoder().encode('tampered data');
      
      const signature = await keyManager.sign(keyId, data);
      
      // Verify with tampered data should fail
      const isValid = await keyManager.verify(keyId, tamperedData, signature);
      expect(isValid).toBe(false);
    });
  });

  describe('Address Derivation', () => {
    test('should derive Bitcoin address from secp256k1 key', async () => {
      const keyId = await keyManager.createKey({ type: 'secp256k1', network: 'testnet' });
      const address = await keyManager.deriveAddress(keyId);
      
      expect(address).not.toBeNull();
      // Check if it starts with a valid testnet prefix
      if (address) {
        expect(address.startsWith('tb1')).toBe(true);
      }
    });

    test('should derive Taproot address from schnorr key', async () => {
      const keyId = await keyManager.createKey({ type: 'schnorr', network: 'testnet' });
      const address = await keyManager.deriveAddress(keyId);
      
      expect(address).not.toBeNull();
      // Check if it starts with a valid testnet Taproot prefix
      if (address) {
        expect(address.startsWith('tb1p')).toBe(true);
      }
    });

    test('should not derive address from Ed25519 key', async () => {
      const keyId = await keyManager.createKey({ type: 'Ed25519' });
      const address = await keyManager.deriveAddress(keyId);
      
      expect(address).toBeNull();
    });
  });

  describe('DID Conversion', () => {
    test('should convert Ed25519 key to DID', async () => {
      const keyId = await keyManager.createKey({ type: 'Ed25519' });
      const did = await keyManager.toDid(keyId);
      
      expect(did).toBeDefined();
      expect(did.startsWith('did:key:z6Mk')).toBe(true);
    });

    test('should throw error when converting non-Ed25519 key to DID', async () => {
      const keyId = await keyManager.createKey({ type: 'secp256k1' });
      
      try {
        await keyManager.toDid(keyId);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect((error as Error).message).toContain('Only Ed25519 keys');
      }
    });
  });
}); 