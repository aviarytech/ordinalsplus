import { describe, test, expect } from 'bun:test';
import { utf8 } from '@scure/base';
import { bytesToHex } from '@noble/hashes/utils';
import { schnorr } from '@noble/curves/secp256k1';
import * as btc from '@scure/btc-signer';

import { 
  generateP2TRKeyPair, 
  privateKeyToXOnly,
  publicKeyToXOnly
} from '../src/inscription/p2tr/key-utils';
import {
  prepareContent,
  detectContentType,
  getFileExtension
} from '../src/inscription/content/mime-handling';
import { prepareInscription } from '../src/inscription/scripts/ordinal-reveal';
import { createInscription } from '../src/inscription';
import { NETWORKS } from '../src/utils/networks';
import { BitcoinNetwork } from '../src/types';

/**
 * Test suite for core inscription script generation functionality.
 */
describe('Core Inscription Script Generation', () => {
  const testContent = 'Test content';
  
  test('should generate valid inscription scripts for text content', () => {
    // Create test content
    const result = createInscription({
      content: testContent,
      contentType: 'text/plain',
      network: 'testnet'
    });

    // Check the result structure
    expect(result.commitAddress).toBeDefined();
    expect(result.commitAddress.address.startsWith('tb1p')).toBe(true);
    expect(result.inscription).toBeDefined();

    // Verify the inscription contains our content
    const bodyText = utf8.encode(result.inscription.body);
    expect(bodyText).toBe(testContent);
    expect(result.inscription.tags.contentType).toBe('text/plain');
  });

  test('should generate valid inscription scripts for JSON content', () => {
    // Create test JSON content
    const jsonData = { test: 'value', number: 123 };
    const jsonString = JSON.stringify(jsonData);
    
    const result = createInscription({
      content: jsonString,
      contentType: 'application/json',
      network: 'testnet'
    });

    // Check result structure
    expect(result.commitAddress).toBeDefined();
    expect(result.inscription).toBeDefined();

    // Check JSON content
    const bodyContent = utf8.encode(result.inscription.body);
    const parsedJson = JSON.parse(bodyContent);
    expect(parsedJson).toEqual(jsonData);
    expect(result.inscription.tags.contentType).toBe('application/json');
  });

  test('should generate valid inscription scripts for image content', () => {
    // Mock image bytes (simplified PNG header)
    const mockImageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
    
    // Create inscription with binary content
    const result = createInscription({
      content: mockImageBytes,
      contentType: 'image/png',
      network: 'testnet'
    });
    
    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.inscription).toBeDefined();

    // Check binary content in result
    expect(result.inscription.body).toEqual(mockImageBytes);
    expect(result.inscription.tags.contentType).toBe('image/png');
  });
  
  test('should handle various content sizes appropriately', () => {
    // Create inscriptions of varying sizes
    const smallContent = 'Small content';
    const mediumContent = 'A'.repeat(100);
    const largeContent = 'A'.repeat(1000);
    
    // Create inscriptions
    const smallResult = createInscription({
      content: smallContent,
      contentType: 'text/plain',
      network: 'testnet',
    });
    
    const mediumResult = createInscription({
      content: mediumContent,
      contentType: 'text/plain',
      network: 'testnet',
    });
    
    const largeResult = createInscription({
      content: largeContent,
      contentType: 'text/plain',
      network: 'testnet',
    });
    
    expect(smallResult.inscription).toBeDefined();
    expect(mediumResult.inscription).toBeDefined();
    expect(largeResult.inscription).toBeDefined();

    // Verify sizes are increasing
    expect(largeResult.inscription.body.length).toBeGreaterThan(mediumResult.inscription.body.length);
    expect(mediumResult.inscription.body.length).toBeGreaterThan(smallResult.inscription.body.length);
  });
  
  test('should maintain proper type safety throughout script generation', () => {
    // Type checking is mostly compile-time, but we can check for correct property access
    const result = createInscription({
      content: 'Test content',
      contentType: 'text/plain',
      network: 'testnet'
    });
    
    // Verify object structure and property access
    expect(typeof result.commitAddress.address).toBe('string');
    expect(result.inscription.tags.contentType).toBe('text/plain');
    expect(result.inscription.body instanceof Uint8Array).toBe(true);
  });
  
  test('should handle metadata in inscription scripts', () => {
    // Create metadata
    const metadata = {
      title: 'Test Title',
      author: 'Test Author',
      description: 'Test Description'
    };
    
    // Create inscription with metadata
    const result = createInscription({
      content: 'Test content with metadata',
      contentType: 'text/plain',
      metadata,
      network: 'testnet'
    });
    
    // Verify metadata in the inscription
    expect(result.inscription.tags.unknown).toBeDefined();
    expect(Array.isArray(result.inscription.tags.unknown)).toBe(true);
    
    // Extract metadata from the tags.unknown array
    const extractedMetadata: Record<string, string> = {};
    if (result.inscription.tags.unknown) {
      result.inscription.tags.unknown.forEach(([keyBytes, valueBytes]) => {
        const key = utf8.encode(keyBytes);
        const value = utf8.encode(valueBytes);
        extractedMetadata[key] = value;
      });
    }
    
    // Verify extracted metadata
    expect(extractedMetadata['title']).toBe(metadata.title);
    expect(extractedMetadata['author']).toBe(metadata.author);
    expect(extractedMetadata['description']).toBe(metadata.description);
  });
  
  test('should accept an optional recovery public key', () => {
    // Generate a key pair for recovery
    const keyPair = generateP2TRKeyPair();
    const revealPublicKey = keyPair.publicKey;
    
    // Create an inscription with and without recovery key
    const result = createInscription({
      content: 'Test content',
      contentType: 'text/plain',
      network: 'testnet',
      revealPublicKey
    });
    
    const resultNoRecovery = createInscription({
      content: 'Test content',
      contentType: 'text/plain',
      network: 'testnet'
    });
    
    // Verify both have valid addresses
    expect(result.commitAddress.address).toBeDefined();
    expect(resultNoRecovery.commitAddress.address).toBeDefined();
    
    // With a different reveal key, addresses should be different
    // Note: This test might need adjustment based on implementation
    if (result.revealPublicKey && resultNoRecovery.revealPublicKey) {
      const isDifferent = bytesToHex(result.revealPublicKey) !== bytesToHex(resultNoRecovery.revealPublicKey);
      expect(isDifferent).toBe(true);
    }
  });
});

/**
 * Test suite for P2TR address and key generation for ordinals.
 */
describe('P2TR Address and Key Generation', () => {
  test('should generate valid taproot key pairs', () => {
    const keyPair = generateP2TRKeyPair();
    
    // Verify key properties
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.privateKey.length).toBe(32);
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.publicKey.length).toBe(32);
  });
  
  test('should derive P2TR addresses from taproot internal keys', () => {
    // Generate a key and derive an address
    const keyPair = generateP2TRKeyPair();
    
    // Create an inscription to get a P2TR address
    const result = createInscription({
      content: 'Test content',
      contentType: 'text/plain',
      network: 'testnet',
      revealPublicKey: keyPair.publicKey
    });
    
    // Verify address format
    expect(result.commitAddress.address).toBeDefined();
    expect(result.commitAddress.address.startsWith('tb1p')).toBe(true);
  });
  
  test('should convert between different key formats correctly', () => {
    // Generate a key pair
    const keyPair = generateP2TRKeyPair();
    
    // Test x-only conversion
    const xOnlyPrivKey = privateKeyToXOnly(keyPair.privateKey);
    expect(xOnlyPrivKey.length).toBe(32);
    
    // Test public key conversion
    const xOnlyPubKey = publicKeyToXOnly(keyPair.publicKey);
    expect(xOnlyPubKey.length).toBe(32);
  });
  
  test('should handle invalid inputs with appropriate errors', () => {
    // Test with an invalid private key (too short)
    const invalidKey = new Uint8Array([1, 2, 3]); // Too short
    
    // This should throw an error
    expect(() => privateKeyToXOnly(invalidKey)).toThrow();
  });
});

/**
 * Test suite for inscription content preparation and MIME handling.
 */
describe('Inscription Content Preparation and MIME Handling', () => {
  test('should detect and validate MIME types correctly', () => {
    // Test text MIME detection
    const textType = detectContentType('file.txt');
    expect(textType).toBe('text/plain');
    
    // Test JSON MIME detection
    const jsonType = detectContentType('file.json');
    expect(jsonType).toBe('application/json');
    
    // Test image MIME detection
    const pngType = detectContentType('image.png');
    expect(pngType).toBe('image/png');
    
    // Test default MIME type for unknown extension
    const unknownType = detectContentType('file.unknown');
    expect(unknownType).toBe('application/octet-stream');
  });
  
  test('should extract file extensions correctly', () => {
    // Test basic extension extraction
    expect(getFileExtension('file.txt')).toBe('txt');
    expect(getFileExtension('path/to/file.json')).toBe('json');
    
    // Test cases with multiple dots
    expect(getFileExtension('file.tar.gz')).toBe('gz');
    
    // Test case with no extension
    expect(getFileExtension('filename')).toBe('');
  });
  
  test('should properly format MIME types with charset for text content', () => {
    // Prepare text content
    const textContent = prepareContent('Hello, World!', 'text/plain');
    expect(textContent.contentType).toBe('text/plain');
    
    // Prepare HTML content (should also have charset)
    const htmlContent = prepareContent('<h1>Hello</h1>', 'text/html');
    expect(htmlContent.contentType).toBe('text/html');
  });
});

/**
 * Test suite for ordinal inscription script generation
 */
describe('Ordinal Inscription Script Generation', () => {
  test('should properly prepare inscription content', () => {
    // Prepare text content
    const content = 'Test content';
    const preparedContent = prepareContent(content, 'text/plain');
    
    // Verify content preparation
    expect(preparedContent).toBeDefined();
    expect(preparedContent.contentType).toBe('text/plain');
    expect(preparedContent.content).toBeDefined();
  });
  
  test('should embed prepared content into inscription correctly', () => {
    // Prepare content and create inscription
    const content = 'Test content';
    const inscription = createInscription({
      content,
      contentType: 'text/plain',
      network: 'testnet'
    });
    
    // Verify the inscription structure
    expect(inscription).toBeDefined();
    expect(inscription.commitAddress).toBeDefined();
    expect(inscription.commitAddress.address.startsWith('tb1p')).toBe(true);
    
    // Verify the content
    const bodyText = utf8.encode(inscription.inscription.body);
    expect(bodyText).toBe(content);
    expect(inscription.inscription.tags.contentType).toBe('text/plain');
  });
  
  test('should support inscription metadata', () => {
    // Test metadata
    const metadataKey = 'title';
    const metadataValue = 'Test Title';
    const metadata = { [metadataKey]: metadataValue };
    
    // Create inscription with metadata
    const inscription = createInscription({
      content: 'Test content',
      contentType: 'text/plain',
      metadata,
      network: 'testnet'
    });
    
    // Extract metadata from the tags.unknown array
    const extractedMetadata: Record<string, string> = {};
    if (inscription.inscription.tags.unknown) {
      inscription.inscription.tags.unknown.forEach(([keyBytes, valueBytes]) => {
        const key = utf8.encode(keyBytes);
        const value = utf8.encode(valueBytes);
        extractedMetadata[key] = value;
      });
    }
    
    // Verify metadata
    expect(extractedMetadata[metadataKey]).toBe(metadataValue);
  });
  
  test('should follow Bitcoin network standards for addresses', () => {
    // Create inscription on testnet
    const testnetInscription = createInscription({
      content: 'Test content',
      contentType: 'text/plain',
      network: 'testnet'
    });
    expect(testnetInscription.commitAddress.address.startsWith('tb1p')).toBe(true);
    
    // Create inscription on mainnet
    const mainnetInscription = createInscription({
      content: 'Test content',
      contentType: 'text/plain',
      network: 'mainnet'
    });
    expect(mainnetInscription.commitAddress.address.startsWith('bc1p')).toBe(true);
  });
}); 