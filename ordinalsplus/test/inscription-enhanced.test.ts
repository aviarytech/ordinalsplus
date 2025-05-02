/**
 * Tests for the Enhanced Ordinals Inscription Implementation
 */

import * as assert from 'assert';
import { describe, it } from 'mocha';
import * as ordinals from '../src/inscription/index-new';
import { generateP2TRKeyPair } from '../src/inscription/p2tr/key-utils';
import { createOrdinalInscription } from '../src/inscription/scripts/ordinal-reveal';
import { prepareContent, MimeType } from '../src/inscription/content/mime-handling';

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