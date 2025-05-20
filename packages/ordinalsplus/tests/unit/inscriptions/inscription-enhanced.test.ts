/**
 * Tests for the Enhanced Ordinals Inscription Implementation
 */

import * as assert from 'assert';
import { describe, it, test, expect } from 'bun:test';
import * as ordinals from '../src/inscription';
import { generateP2TRKeyPair } from '../src/inscription/p2tr/key-utils';
import { createOrdinalInscription } from '../src/inscription/scripts/ordinal-reveal';
import { prepareContent, MimeType } from '../src/inscription/content/mime-handling';
import { hex, utf8 } from '@scure/base';
import { bytesToHex } from '@noble/hashes/utils';
import { 
  createInscription,
  createTextInscription,
  createJsonInscription
} from '../src/inscription';

describe('Enhanced Ordinals Inscription', () => {
  describe('P2TR Key Utilities', () => {
    it('should generate valid P2TR key pairs', () => {
      const keyPair = generateP2TRKeyPair();
      
      // Check that key pair has the expected properties
      assert.strictEqual(keyPair.privateKey.length, 32, 'Private key should be 32 bytes');
      assert.strictEqual(keyPair.publicKey.length, 32, 'Public key should be 32 bytes (x-only)');
      assert.strictEqual(typeof keyPair.publicKeyHex, 'string', 'Public key hex should be a string');
      assert.strictEqual(keyPair.publicKeyHex.length, 64, 'Public key hex should be 64 characters');
    });
    
    it('should create P2TR addresses from public keys', () => {
      const keyPair = generateP2TRKeyPair();
      const address = ordinals.publicKeyToP2TRAddress(keyPair.publicKey, 'testnet');
      
      // Check that address has expected properties
      assert.strictEqual(typeof address.address, 'string', 'Address should be a string');
      assert.ok(address.address.startsWith('tb1p'), 'Testnet P2TR address should start with tb1p');
      assert.ok(address.script.length > 0, 'Script should not be empty');
      assert.deepStrictEqual(address.internalKey, keyPair.publicKey, 'Internal key should match public key');
    });
  });
  
  describe('Content Preparation', () => {
    it('should prepare text content correctly', () => {
      const text = 'Hello, Ordinals!';
      const prepared = prepareContent(text, MimeType.PLAIN_TEXT);
      
      assert.strictEqual(prepared.contentType, MimeType.PLAIN_TEXT, 'Content type should match');
      assert.ok(prepared.content instanceof Uint8Array, 'Content should be converted to Uint8Array');
      
      // Convert back to text for comparison
      const textDecoder = new TextDecoder();
      const decodedText = textDecoder.decode(prepared.content);
      assert.strictEqual(decodedText, text, 'Text content should be preserved');
    });
    
    it('should prepare JSON content correctly', () => {
      const jsonData = { message: 'Hello, Ordinals!', value: 42 };
      const jsonText = JSON.stringify(jsonData);
      const prepared = prepareContent(jsonText, MimeType.JSON);
      
      assert.strictEqual(prepared.contentType, MimeType.JSON, 'Content type should match');
      
      // Convert back to JSON for comparison
      const textDecoder = new TextDecoder();
      const decodedText = textDecoder.decode(prepared.content);
      const decodedJson = JSON.parse(decodedText);
      assert.deepStrictEqual(decodedJson, jsonData, 'JSON content should be preserved');
    });
    
    it('should guess MIME type from filename', () => {
      assert.strictEqual(ordinals.guessMimeType('test.txt'), MimeType.PLAIN_TEXT);
      assert.strictEqual(ordinals.guessMimeType('image.png'), MimeType.PNG);
      assert.strictEqual(ordinals.guessMimeType('data.json'), MimeType.JSON);
      assert.strictEqual(ordinals.guessMimeType('script.js'), MimeType.JAVASCRIPT);
    });
  });
  
  describe('Inscription Script Generation', () => {
    it('should convert prepared content to ordinal inscription format', () => {
      const text = 'Hello, Ordinals!';
      const prepared = prepareContent(text, MimeType.PLAIN_TEXT);
      const inscription = createOrdinalInscription(prepared);
      
      assert.strictEqual(inscription.tags.contentType, MimeType.PLAIN_TEXT, 'Content type should match');
      assert.ok(inscription.body instanceof Uint8Array, 'Body should be a Uint8Array');
      
      // Convert back to text for comparison
      const textDecoder = new TextDecoder();
      const decodedText = textDecoder.decode(inscription.body);
      assert.strictEqual(decodedText, text, 'Text content should be preserved');
    });
    
    it('should include metadata in inscriptions when provided', () => {
      const text = 'Hello, Ordinals!';
      const metadata = { author: 'Satoshi', app: 'OrdinalsPlus' };
      const prepared = prepareContent(text, MimeType.PLAIN_TEXT, metadata);
      const inscription = createOrdinalInscription(prepared);
      
      assert.ok(inscription.tags.unknown, 'Unknown tags should be present');
      assert.strictEqual(inscription.tags.unknown?.length, 2, 'Should have 2 metadata entries');
    });
  });
  
  describe('Full Inscription Workflow', () => {
    it('should create a complete text inscription in one step', () => {
      const text = 'Hello, Ordinals!';
      const result = ordinals.createTextInscription(text, 'testnet');
      
      // Check for expected properties
      assert.ok(result.commitAddress.address, 'Should have a commit address');
      assert.ok(result.commitAddress.address.startsWith('tb1p'), 'Address should be a testnet P2TR address');
      assert.ok(result.revealPublicKey, 'Should have a reveal public key');
      assert.ok(result.revealPrivateKey, 'Should have a reveal private key');
      assert.ok(result.inscriptionScript.script, 'Should have an inscription script');
      assert.ok(result.inscriptionScript.controlBlock, 'Should have a control block');
      
      // Check inscription content
      assert.strictEqual(result.inscription.tags.contentType, MimeType.PLAIN_TEXT, 'Content type should match');
      
      // Convert back to text for comparison
      const textDecoder = new TextDecoder();
      const decodedText = textDecoder.decode(result.inscription.body);
      assert.strictEqual(decodedText, text, 'Text content should be preserved');
    });
    
    it('should create a complete JSON inscription in one step', () => {
      const jsonData = { message: 'Hello, Ordinals!', value: 42 };
      const result = ordinals.createJsonInscription(jsonData, 'testnet');
      
      // Check for expected properties
      assert.ok(result.commitAddress.address, 'Should have a commit address');
      assert.ok(result.commitAddress.address.startsWith('tb1p'), 'Address should be a testnet P2TR address');
      
      // Check inscription content
      assert.strictEqual(result.inscription.tags.contentType, MimeType.JSON, 'Content type should match');
      
      // Convert back to JSON for comparison
      const textDecoder = new TextDecoder();
      const decodedText = textDecoder.decode(result.inscription.body);
      const decodedJson = JSON.parse(decodedText);
      assert.deepStrictEqual(decodedJson, jsonData, 'JSON content should be preserved');
    });
    
    it('should use provided reveal public key if specified', () => {
      const keyPair = generateP2TRKeyPair();
      const text = 'Hello, Ordinals!';
      
      const result = ordinals.createInscription({
        content: text,
        contentType: MimeType.PLAIN_TEXT,
        network: 'testnet',
        revealPublicKey: keyPair.publicKey
      });
      
      // Check that the reveal key matches what we provided
      assert.deepStrictEqual(result.revealPublicKey, keyPair.publicKey, 'Reveal public key should match provided key');
      assert.strictEqual(result.revealPrivateKey, undefined, 'Reveal private key should be undefined');
    });
  });
});

/**
 * Test suite for Task 2: Enhanced Inscription Script Generation
 * 
 * These tests verify the high-level API functions that implement
 * the inscription generation functionality.
 */
describe('Enhanced Inscription Generation', () => {
  test('should create text inscriptions', () => {
    // Create a simple text inscription
    const textContent = 'Hello, Bitcoin!';
    const result = createTextInscription(textContent, 'testnet');
    
    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.commitAddress.address.startsWith('tb1p')).toBe(true); // Testnet P2TR address
    expect(result.inscriptionScript).toBeDefined();
    
    // Convert inscriptionScript to hex for inspection
    const scriptHex = Buffer.from(result.inscriptionScript.script).toString('hex');
    const contentBytes = Buffer.from(textContent);
    const contentHex = contentBytes.toString('hex');
    
    // Verify the content is embedded in the inscription script
    expect(scriptHex).toContain(contentHex);
    
    // Verify the content type is embedded as well
    const contentTypeBytes = Buffer.from('text/plain');
    const contentTypeHex = contentTypeBytes.toString('hex');
    expect(scriptHex).toContain(contentTypeHex);
  });
  
  test('should create JSON inscriptions', () => {
    // Create a JSON inscription
    const jsonData = { name: 'Test Inscription', value: 123 };
    const result = createJsonInscription(jsonData, 'testnet');
    
    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.inscriptionScript).toBeDefined();
    
    // Convert inscriptionScript to hex for inspection
    const scriptHex = Buffer.from(result.inscriptionScript.script).toString('hex');
    const jsonString = JSON.stringify(jsonData);
    const contentBytes = Buffer.from(jsonString);
    const contentHex = contentBytes.toString('hex');
    
    // Verify the content is embedded in the inscription script
    expect(scriptHex).toContain(contentHex);
    
    // Verify the content type is embedded as well
    const contentTypeBytes = Buffer.from('application/json');
    const contentTypeHex = contentTypeBytes.toString('hex');
    expect(scriptHex).toContain(contentTypeHex);
  });
  
  test('should accept binary content with proper mime type', () => {
    // Create a mock binary content (PNG header)
    const pngContent = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    
    // Create an inscription with binary content
    const result = createInscription({
      content: pngContent,
      contentType: 'image/png',
      network: 'testnet'
    });
    
    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.inscriptionScript).toBeDefined();
    
    // Convert inscriptionScript to hex for inspection
    const scriptHex = Buffer.from(result.inscriptionScript.script).toString('hex');
    const contentHex = Buffer.from(pngContent).toString('hex');
    
    // Verify the content is embedded in the inscription script
    expect(scriptHex).toContain(contentHex);
    
    // Verify the content type is embedded as well
    const contentTypeBytes = Buffer.from('image/png');
    const contentTypeHex = contentTypeBytes.toString('hex');
    expect(scriptHex).toContain(contentTypeHex);
  });
  
  test('should handle various content sizes', () => {
    // Test with small content
    const smallContent = 'Small test';
    const smallResult = createTextInscription(smallContent, 'testnet');
    
    // Test with medium content
    const mediumContent = 'A'.repeat(1000);
    const mediumResult = createTextInscription(mediumContent, 'testnet');
    
    // Test with large content
    const largeContent = 'A'.repeat(10000);
    const largeResult = createTextInscription(largeContent, 'testnet');
    
    // All should produce valid inscriptions
    expect(smallResult.inscriptionScript.script).toBeDefined();
    expect(mediumResult.inscriptionScript.script).toBeDefined();
    expect(largeResult.inscriptionScript.script).toBeDefined();
    
    // Script sizes should increase with content size
    expect(largeResult.inscriptionScript.script.length).toBeGreaterThan(mediumResult.inscriptionScript.script.length);
    expect(mediumResult.inscriptionScript.script.length).toBeGreaterThan(smallResult.inscriptionScript.script.length);
  });
  
  test('should include metadata in inscriptions', () => {
    // Create an inscription with metadata
    const metadata = {
      title: 'Test Title',
      author: 'Test Author',
      description: 'Test Description'
    };
    
    const result = createInscription({
      content: 'Content with metadata',
      contentType: 'text/plain',
      metadata,
      network: 'testnet'
    });
    
    // Verify the result structure
    expect(result).toBeDefined();
    expect(result.inscriptionScript).toBeDefined();
    
    // Check for metadata values in the script
    const scriptHex = Buffer.from(result.inscriptionScript.script).toString('hex');
    
    // Convert each metadata value to hex and check if it's in the script
    Object.values(metadata).forEach(value => {
      const valueBytes = Buffer.from(value);
      const valueHex = valueBytes.toString('hex');
      expect(scriptHex).toContain(valueHex);
    });
  });
}); 