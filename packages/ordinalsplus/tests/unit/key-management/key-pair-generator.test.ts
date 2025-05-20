/**
 * Tests for the KeyPairGenerator module
 */
 
import { describe, test, expect } from 'bun:test';
import { KeyPairGenerator } from '../../key-management/key-pair-generator';
import { bytesToHex } from '@noble/hashes/utils';

describe('KeyPairGenerator', () => {
  describe('Ed25519 key generation', () => {
    test('should generate valid Ed25519 key pairs', () => {
      const keyPair = KeyPairGenerator.generateEd25519KeyPair();
      
      // Check that keys are present and have correct types
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.keyType).toBe('Ed25519');
      
      // Check key lengths
      expect(keyPair.privateKey.length).toBe(32);
      expect(keyPair.publicKey.length).toBe(32);
    });
    
    test('should generate different keys on each call', () => {
      const keyPair1 = KeyPairGenerator.generateEd25519KeyPair();
      const keyPair2 = KeyPairGenerator.generateEd25519KeyPair();
      
      // Keys should be different
      expect(bytesToHex(keyPair1.privateKey)).not.toBe(bytesToHex(keyPair2.privateKey));
      expect(bytesToHex(keyPair1.publicKey)).not.toBe(bytesToHex(keyPair2.publicKey));
    });
    
    test('should respect provided entropy', () => {
      // Create entropy for testing - 32 bytes of zeros
      const entropy = new Uint8Array(32).fill(0);
      
      const keyPair = KeyPairGenerator.generateEd25519KeyPair({ entropy });
      
      // Private key should match the entropy
      expect(bytesToHex(keyPair.privateKey)).toBe(bytesToHex(entropy));
    });
  });
  
  describe('secp256k1 key generation', () => {
    test('should generate valid secp256k1 key pairs', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair();
      
      // Check that keys are present and have correct types
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKeyCompressed).toBeInstanceOf(Uint8Array);
      expect(keyPair.keyType).toBe('secp256k1');
      
      // Check key lengths
      expect(keyPair.privateKey.length).toBe(32);
      expect(keyPair.publicKey.length).toBe(65); // Uncompressed secp256k1 public keys are 65 bytes
      expect(keyPair.publicKeyCompressed.length).toBe(33); // Compressed secp256k1 public keys are 33 bytes
    });
    
    test('should include address when requested', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair({ includeAddress: true });
      
      // Address should be included
      expect(keyPair.address).toBeDefined();
      expect(typeof keyPair.address).toBe('string');
      
      // For mainnet, address should start with '1'
      expect(keyPair.address?.startsWith('1')).toBe(true);
    });
    
    test('should include WIF when requested', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair({ includeWif: true });
      
      // WIF should be included
      expect(keyPair.wif).toBeDefined();
      expect(typeof keyPair.wif).toBe('string');
      
      // For mainnet private keys, WIF should start with 'K' or 'L' for compressed
      expect(keyPair.wif?.startsWith('K') || keyPair.wif?.startsWith('L')).toBe(true);
    });
    
    test('should respect network parameter', () => {
      const mainnetKeyPair = KeyPairGenerator.generateSecp256k1KeyPair({ 
        network: 'mainnet', 
        includeAddress: true,
        includeWif: true 
      });
      
      const testnetKeyPair = KeyPairGenerator.generateSecp256k1KeyPair({ 
        network: 'testnet', 
        includeAddress: true,
        includeWif: true 
      });
      
      // Mainnet address should start with '1'
      expect(mainnetKeyPair.address?.startsWith('1')).toBe(true);
      
      // Testnet address should start with 'm' or 'n'
      expect(
        testnetKeyPair.address?.startsWith('m') || 
        testnetKeyPair.address?.startsWith('n')
      ).toBe(true);
      
      // Testnet WIF should start with different characters than mainnet
      expect(testnetKeyPair.wif?.startsWith('c')).toBe(true);
    });
  });
  
  describe('Schnorr key generation', () => {
    test('should generate valid Schnorr key pairs', () => {
      const keyPair = KeyPairGenerator.generateSchnorrKeyPair();
      
      // Check that keys are present and have correct types
      expect(keyPair.privateKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKeyXOnly).toBeInstanceOf(Uint8Array);
      expect(keyPair.keyType).toBe('schnorr');
      
      // Check key lengths
      expect(keyPair.privateKey.length).toBe(32);
      expect(keyPair.publicKey.length).toBe(33); // Schnorr public keys are 33 bytes
      expect(keyPair.publicKeyXOnly.length).toBe(32); // X-only public keys are 32 bytes
    });
    
    test('should include taproot address when requested', () => {
      const keyPair = KeyPairGenerator.generateSchnorrKeyPair({ includeAddress: true });
      
      // Taproot address should be included
      expect(keyPair.tapRootAddress).toBeDefined();
      expect(typeof keyPair.tapRootAddress).toBe('string');
      
      // Taproot addresses start with 'bc1p' on mainnet
      expect(keyPair.tapRootAddress?.startsWith('bc1p')).toBe(true);
    });
    
    test('should respect network parameter for taproot address', () => {
      const mainnetKeyPair = KeyPairGenerator.generateSchnorrKeyPair({ 
        network: 'mainnet', 
        includeAddress: true
      });
      
      const testnetKeyPair = KeyPairGenerator.generateSchnorrKeyPair({ 
        network: 'testnet', 
        includeAddress: true
      });
      
      // Mainnet taproot should start with 'bc1p'
      expect(mainnetKeyPair.tapRootAddress?.startsWith('bc1p')).toBe(true);
      
      // Testnet taproot should start with 'tb1p'
      expect(testnetKeyPair.tapRootAddress?.startsWith('tb1p')).toBe(true);
    });
  });
  
  describe('Address conversion', () => {
    test('should convert public key to Bitcoin address', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair();
      const address = KeyPairGenerator.publicKeyToAddress(keyPair.publicKeyCompressed);
      
      // Check that it's a string and looks like an address
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(25);
      expect(address.length).toBeLessThan(35);
      
      // For mainnet, should start with '1'
      expect(address.startsWith('1')).toBe(true);
    });
    
    test('should convert public key to testnet address', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair();
      const address = KeyPairGenerator.publicKeyToAddress(keyPair.publicKeyCompressed, 'testnet');
      
      // Testnet addresses start with 'm' or 'n'
      expect(
        address.startsWith('m') || 
        address.startsWith('n')
      ).toBe(true);
    });
  });
  
  describe('WIF conversion', () => {
    test('should convert private key to WIF', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair();
      const wif = KeyPairGenerator.privateKeyToWIF(keyPair.privateKey);
      
      // Check that it's a string and looks like a WIF
      expect(typeof wif).toBe('string');
      expect(wif.length).toBeGreaterThan(50);
      expect(wif.length).toBeLessThan(53);
      
      // For mainnet compressed, should start with 'K' or 'L'
      expect(wif.startsWith('K') || wif.startsWith('L')).toBe(true);
    });
    
    test('should convert private key to testnet WIF', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair();
      const wif = KeyPairGenerator.privateKeyToWIF(keyPair.privateKey, 'testnet');
      
      // Testnet WIF should start with 'c'
      expect(wif.startsWith('c')).toBe(true);
    });
    
    test('should handle uncompressed WIF format', () => {
      const keyPair = KeyPairGenerator.generateSecp256k1KeyPair();
      const wif = KeyPairGenerator.privateKeyToWIF(keyPair.privateKey, 'mainnet', false);
      
      // For mainnet uncompressed, should start with '5'
      expect(wif.startsWith('5')).toBe(true);
    });
  });
}); 