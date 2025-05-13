import { expect, test, describe } from 'bun:test';
import { utf8 } from '@scure/base';
import { bytesToHex } from '@noble/hashes/utils';

import { 
  createInscription,
  createTextInscription, 
  createJsonInscription,
  prepareInscription,
  prepareContent,
  generateP2TRKeyPair
} from '../src/inscription';

describe('Enhanced Inscription Module', () => {
  const content = 'Hello, Ordinals!';
  const text = 'Simple text inscription';
  const jsonData = { name: 'Test Inscription', value: 123, nested: { key: 'value' } };
  const metadata = {
    title: 'Test Title',
    author: 'Test Author',
    description: 'This is a test inscription'
  };

  test('createInscription should create a valid inscription', () => {
    // Prepare content for test
    const result = createInscription({
      content,
      contentType: 'text/plain',
      network: 'testnet'
    });

    // Check the structure of the result
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.inscription).toBeDefined();
    expect(result.inscription.tags.contentType).toBe('text/plain');

    // Verify content is correctly encoded
    const contentBytes = utf8.decode(content);
    const bodyText = utf8.encode(result.inscription.body);
    expect(bodyText).toBe(content);
    expect(bytesToHex(result.inscription.body)).toBe(bytesToHex(contentBytes));
  });
  
  test('createTextInscription should create a valid text inscription', () => {
    const result = createTextInscription(text, 'testnet');
    
    // Check result structure
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.inscription.tags.contentType).toBe('text/plain');
    
    // Verify content
    const contentBytes = utf8.decode(text);
    const bodyText = utf8.encode(result.inscription.body);
    expect(bodyText).toBe(text);
    expect(bytesToHex(result.inscription.body)).toBe(bytesToHex(contentBytes));
  });
  
  test('createJsonInscription should create a valid JSON inscription', () => {
    const result = createJsonInscription(jsonData, 'testnet');
    
    // Verify result structure
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.inscription.tags.contentType).toBe('application/json');
    
    // Verify JSON content is correctly encoded
    const jsonString = JSON.stringify(jsonData);
    const contentBytes = utf8.decode(jsonString);
    const bodyText = utf8.encode(result.inscription.body);
    const parsedJson = JSON.parse(bodyText);
    expect(parsedJson).toEqual(jsonData);
    expect(bytesToHex(result.inscription.body)).toBe(bytesToHex(contentBytes));
  });
  
  test('prepareContent should handle different content types', () => {
    // Text content
    const textContent = prepareContent('Hello', 'text/plain');
    expect(textContent.contentType).toBe('text/plain');
    
    // JSON content
    const jsonObject = { test: 'world' };
    const jsonString = JSON.stringify(jsonObject);
    const jsonContent = prepareContent(jsonString, 'application/json');
    expect(jsonContent.contentType).toBe('application/json');
    
    // Binary content
    const binaryData = new Uint8Array([1, 2, 3]);
    const binaryContent = prepareContent(binaryData, 'application/octet-stream');
    expect(binaryContent.contentType).toBe('application/octet-stream');
  });
  
  test('prepareInscription should create valid inscription from prepared content', () => {
    // Create test key pair
    const keyPair = generateP2TRKeyPair();
    const revealPublicKey = keyPair.publicKey;

    // Create content
    const preparedContent = prepareContent('Test content', 'text/plain');

    // Call function under test
    const result = prepareInscription({
      content: preparedContent,
      revealPublicKey,
      network: 'testnet'
    });

    // Verify structure
    expect(result).toBeDefined();
    expect(result.commitAddress).toBeDefined();
    expect(result.commitAddress.address.startsWith('tb1p')).toBe(true);
    expect(result.inscription).toBeDefined();
    expect(result.revealPublicKey).toBeDefined();

    // Content should be correctly preserved
    const bodyText = utf8.encode(result.inscription.body);
    expect(bodyText).toBe('Test content');
    expect(result.inscription.tags.contentType).toBe('text/plain');
  });
  
  test('generateP2TRKeyPair should generate valid key pairs', () => {
    const keyPair = generateP2TRKeyPair();
    
    // Verify key pair structure
    expect(keyPair).toBeDefined();
    expect(keyPair.privateKey).toBeDefined();
    expect(keyPair.privateKey.length).toBe(32);
    expect(keyPair.publicKey).toBeDefined();
    expect(keyPair.publicKey.length).toBe(32);
  });
  
  test('inscription should generate valid P2TR addresses', () => {
    // Create an inscription
    const result = createInscription({
      content: 'Address test',
      contentType: 'text/plain',
      network: 'testnet'
    });

    // Check P2TR address format
    expect(result.commitAddress).toBeDefined();
    expect(result.commitAddress.address).toBeDefined();
    expect(result.commitAddress.address.startsWith('tb1p')).toBe(true);

    // Mainnet addresses should start with bc1p
    const mainnetResult = createInscription({
      content: 'Address test',
      contentType: 'text/plain',
      network: 'mainnet'
    });
    expect(mainnetResult.commitAddress.address.startsWith('bc1p')).toBe(true);
  });
  
  test('should handle metadata in inscriptions', () => {
    // Create an inscription with metadata
    const result = createInscription({
      content: 'Test with metadata',
      contentType: 'text/plain',
      metadata,
      network: 'testnet'
    });

    // Check the inscription has the metadata in the tags.unknown array
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

    // Verify metadata values are correctly preserved
    expect(extractedMetadata['title']).toBe(metadata.title);
    expect(extractedMetadata['author']).toBe(metadata.author);
    expect(extractedMetadata['description']).toBe(metadata.description);
  });
}); 