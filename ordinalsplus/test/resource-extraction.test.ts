import { describe, expect, it } from 'bun:test';
import { Inscription } from '../src/types';
import { extractSatNumber } from '../src/utils/validators.js';
import { createLinkedResourceFromInscription } from '../src';

describe('Resource Extraction', () => {
  describe('Extracting resource IDs from different inscription formats', () => {
    it('should correctly extract inscription indices from different inscription ID formats', () => {
      const testCases = [
        { id: 'i0', expectedIndex: 0 },
        { id: 'i123', expectedIndex: 123 },
        { id: 'abci456', expectedIndex: 456 }
      ];

      testCases.forEach(testCase => {
        const inscription: Inscription = {
          id: testCase.id,
          sat: 87654321,
          content_type: 'application/json',
          content_url: 'https://ordinalsplus.com/resource/1',
          number: testCase.expectedIndex
        };
        const resource = createLinkedResourceFromInscription(inscription, 'TestResource', 'testnet');
        expect(resource.id).toBe(`did:btco:87654321/${testCase.expectedIndex}`);
        expect(resource.didReference).toBe('did:btco:87654321');
      });
    });

    it('should use number property when no index in ID', () => {
      const inscription: Inscription = {
        id: 'abc123',
        number: 123,
        sat: 87654321,
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/2'
      };
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource', 'testnet');
      expect(resource.id).toBe('did:btco:87654321/123');
      expect(resource.didReference).toBe('did:btco:87654321');
    });

    it('should throw an error when no index in ID and no number property', () => {
      const inscription: Partial<Inscription> = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fd',
        sat: 87654321,
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/3'
      };
      expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'TestResource', 'testnet'))
        .toThrow('No valid index found in inscription');
    });

    it('should throw an error when no sat or sat_ordinal information is available', () => {
      const inscription: Partial<Inscription> = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/4'
      };
      expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'TestResource', 'testnet'))
        .toThrow('Sat number is required');
    });

    it('should prioritize sat over sat_ordinal when both are present', () => {
      const inscription: Inscription = {
        id: '123',
        sat: 87654321,
        sat_ordinal: '99999999',
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/5',
        number: 0
      };
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource', 'testnet');
      expect(resource.id).toBe('did:btco:87654321/0');
      expect(resource.didReference).toBe('did:btco:87654321');
    });

    it('should handle both numeric and string sat values', () => {
      const inscription1: Inscription = {
        id: '123',
        sat: 12345678,
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/6',
        number: 0
      };
      const resource1 = createLinkedResourceFromInscription(inscription1, 'TestResource', 'testnet');
      expect(resource1.id).toBe('did:btco:12345678/0');
      expect(resource1.didReference).toBe('did:btco:12345678');

      const inscription2: Inscription = {
        id: '456',
        sat: 87654321,
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/7',
        number: 0
      };
      const resource2 = createLinkedResourceFromInscription(inscription2, 'TestResource', 'testnet');
      expect(resource2.id).toBe('did:btco:87654321/0');
      expect(resource2.didReference).toBe('did:btco:87654321');
    });

    it('should throw an error when sat_ordinal does not contain a valid sat number', () => {
      const inscription: Partial<Inscription> = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        sat: 0, // Invalid sat number
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/8'
      };
      expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'TestResource', 'testnet'))
        .toThrow('Sat number is required');
    });
  });

  describe('extractSatNumber', () => {
    it('should extract sat number from inscription with sat property', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        sat: 1234567890,
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/9'
      };
      
      const satNumber = extractSatNumber(inscription);
      expect(satNumber).toBe(1234567890);
    });

    it('should throw error when sat property is missing', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        sat: 0, // Invalid sat number to trigger error
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/10'
      };
      
      expect(() => extractSatNumber(inscription)).toThrow();
    });

    it('should throw error when sat number is invalid', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        sat: 0, // Invalid sat number
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/11'
      };
      
      expect(() => extractSatNumber(inscription)).toThrow();
    });
  });
}); 