import { describe, it, expect } from 'bun:test';
import { 
  createDidDocument, 
  validateDidDocument, 
  serializeDidDocument,
  deserializeDidDocument 
} from '../../src/did/did-document';
import { DidDocument } from '../../src/types/did';

describe('DID Document', () => {
  describe('createDidDocument', () => {
    it('should create a valid DID document with required fields', () => {
      const satNumber = 12345;
      const result = createDidDocument(satNumber);
      
      // Check document structure
      expect(result.document).toBeDefined();
      expect(result.document['@context']).toBeInstanceOf(Array);
      expect(result.document['@context']).toContain('https://www.w3.org/ns/did/v1');
      expect(result.document.id).toBe(`did:btco:${satNumber}`);
      
      // Check verification method
      expect(result.document.verificationMethod).toBeInstanceOf(Array);
      expect(result.document.verificationMethod?.length).toBe(1);
      const vm = result.document.verificationMethod?.[0];
      expect(vm?.id).toBe(`did:btco:${satNumber}#key-1`);
      expect(vm?.type).toBe('Ed25519VerificationKey2020');
      expect(vm?.controller).toBe(`did:btco:${satNumber}`);
      expect(vm?.publicKeyMultibase).toBeDefined();
      expect(typeof vm?.publicKeyMultibase).toBe('string');
      expect(vm?.publicKeyMultibase?.startsWith('z')).toBe(true);
      
      // Check authentication
      expect(result.document.authentication).toBeInstanceOf(Array);
      expect(result.document.authentication?.length).toBe(1);
      expect(result.document.authentication?.[0]).toBe(`did:btco:${satNumber}#key-1`);
      
      // Check keys
      expect(result.publicKey).toBeInstanceOf(Uint8Array);
      expect(result.publicKey.length).toBe(32);
      expect(result.secretKey).toBeInstanceOf(Uint8Array);
      expect(result.secretKey.length).toBe(32);
    });
    
    it('should create a DID document with custom options', () => {
      const satNumber = 67890;
      const controller = 'did:btco:12345';
      const services = [
        {
          id: `did:btco:${satNumber}#service-1`,
          type: 'LinkedDomains',
          serviceEndpoint: 'https://example.com'
        }
      ];
      
      const result = createDidDocument(satNumber, 'mainnet', {
        controller,
        services,
        deactivated: true
      });
      
      // Check custom options
      expect(result.document.controller).toBe(controller);
      expect(result.document.service).toEqual(services);
      expect(result.document.deactivated).toBe(true);
      
      // Check verification method controller is set to custom controller
      const vm = result.document.verificationMethod?.[0];
      expect(vm?.controller).toBe(controller);
    });
    
    it('should create a DID document with network-specific DID prefix', () => {
      const satNumber = 123;
      
      const mainnetResult = createDidDocument(satNumber, 'mainnet');
      expect(mainnetResult.document.id).toBe(`did:btco:${satNumber}`);
      
      const testnetResult = createDidDocument(satNumber, 'testnet');
      expect(testnetResult.document.id).toBe(`did:btco:test:${satNumber}`);
      
      const signetResult = createDidDocument(satNumber, 'signet');
      expect(signetResult.document.id).toBe(`did:btco:sig:${satNumber}`);
    });
  });
  
  describe('validateDidDocument', () => {
    it('should validate a correctly formatted DID document', () => {
      const didDoc = createDidDocument(12345).document;
      const result = validateDidDocument(didDoc);
      
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
    
    it('should reject a DID document missing required fields', () => {
      const invalidDoc = {} as DidDocument;
      const result = validateDidDocument(invalidDoc);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Missing required field: @context');
      expect(result.errors).toContain('Missing required field: id');
    });
    
    it('should validate verification methods correctly', () => {
      // Create a valid document first
      const didDoc = createDidDocument(12345).document;
      
      // Then modify it to be invalid
      const invalidDoc = { ...didDoc };
      invalidDoc.verificationMethod = [{ 
        id: '', // Missing proper ID
        type: 'Ed25519VerificationKey2020',
        controller: didDoc.id
      }];
      
      const result = validateDidDocument(invalidDoc);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('verificationMethod[0] is missing publicKeyMultibase');
    });
  });
  
  describe('serializeDidDocument and deserializeDidDocument', () => {
    it('should correctly serialize and deserialize a DID document', () => {
      const originalDoc = createDidDocument(12345).document;
      const serialized = serializeDidDocument(originalDoc);
      const deserialized = deserializeDidDocument(serialized);
      
      expect(deserialized).not.toBeNull();
      expect(deserialized?.id).toBe(originalDoc.id);
      expect(deserialized?.['@context']).toEqual(originalDoc['@context']);
      expect(deserialized?.verificationMethod?.[0].id).toBe(originalDoc.verificationMethod?.[0].id);
    });
    
    it('should return null when deserializing invalid JSON', () => {
      const invalidJson = '{ "id": "did:btco:12345", "@context": ["https://www.w3.org/ns/did/v1"]';
      const result = deserializeDidDocument(invalidJson);
      
      expect(result).toBeNull();
    });
    
    it('should return null when deserializing valid JSON but invalid DID document', () => {
      const invalidDocJson = '{"id": "did:btco:12345"}'; // Missing @context
      const result = deserializeDidDocument(invalidDocJson);
      
      expect(result).toBeNull();
    });
  });
}); 