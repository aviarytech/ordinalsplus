import { describe, expect, it } from 'bun:test';
import { createLinkedResourceFromInscription } from '../src/did/did-utils.js';
import { Inscription } from '../src/types/index.js';
import { extractSatNumber } from '../src/utils/validators.js';

describe('Resource Extraction', () => {
  describe('Extracting resource IDs from different inscription formats', () => {
    // Test case 1: Testing different patterns for sat_ordinal values
    it('should correctly extract sat numbers from different sat_ordinal formats', () => {
      // Common patterns for sat_ordinal values we might encounter
      const testCases = [
        { sat_ordinal: 'Sat 12345678', expected: '12345678' },
        { sat_ordinal: '12345678th sat', expected: '12345678' },
        { sat_ordinal: 'sat#12345678', expected: '12345678' },
        { sat_ordinal: 'Satoshi 12345678', expected: '12345678' },
        { sat_ordinal: '12345678', expected: '12345678' },
        // Only first group of digits is extracted
        { sat_ordinal: 'Sat 123ABC456', expected: '123' }
      ];
      
      for (const testCase of testCases) {
        const inscription: Inscription = {
          id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
          number: 0,
          sat_ordinal: testCase.sat_ordinal,
          content_type: 'application/json',
          content: {}
        };
        
        const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
        
        // Test both the resource ID and the sat property
        expect(resource.id).toBe(`did:btco:${testCase.expected}/0`);
        expect(resource.sat).toBe(testCase.expected);
      }
    });
    
    // Test case 2: Testing different inscription ID patterns for index extraction
    it('should correctly extract inscription indices from different inscription ID formats', () => {
      const testCases = [
        // Standard format with i0
        { 
          id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
          expectedIndex: 0 
        },
        // Higher index number
        { 
          id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi42',
          expectedIndex: 42 
        },
        // Very large index number
        { 
          id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi999999',
          expectedIndex: 999999 
        }
      ];
      
      for (const testCase of testCases) {
        const inscription: Inscription = {
          id: testCase.id,
          sat: '87654321',
          content_type: 'application/json',
          content: {}
        };
        
        const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
        
        // The resource ID should include the correct index
        expect(resource.id).toBe(`did:btco:87654321/${testCase.expectedIndex}`);
      }
    });

    // Test case 3: Using number property when no index in ID
    it('should use number property when no index in ID', () => {
      const inscription: Inscription = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fd', // No index suffix
        number: 123,
        sat: '87654321',
        content_type: 'application/json',
        content: {}
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      
      // Should use the number property as index
      expect(resource.id).toBe('did:btco:87654321/123');
    });
    
    // Test case 4: Error when no index in ID and no number property
    it('should throw an error when no index in ID and no number property', () => {
      const inscription: Inscription = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fd', // No index suffix
        sat: '87654321',
        content_type: 'application/json',
        content: {}
      };
      
      // Should throw error because there's no inscription index in ID and no number property
      expect(() => createLinkedResourceFromInscription(inscription, 'TestResource')).toThrow();
    });
    
    // Test case 5: Error when no sat information is available
    it('should throw an error when no sat or sat_ordinal information is available', () => {
      // Create inscriptions without sat or sat_ordinal properties
      const testCases = [
        // Basic inscription with no sat info
        { 
          id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        },
        // Inscription with different ID format
        { 
          id: 'abc123def456i0',
        },
        // Inscription with number but no sat
        { 
          id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
          number: 42
        }
      ];
      
      for (const testCase of testCases) {
        const inscription: Inscription = {
          ...testCase,
          content_type: 'application/json',
          content: {}
        };
        
        // Check that it throws an error now instead of falling back
        expect(() => createLinkedResourceFromInscription(inscription, 'TestResource')).toThrow();
      }
    });

    // Test case 6: Test with both sat and sat_ordinal (sat should take precedence)
    it('should prioritize sat over sat_ordinal when both are present', () => {
      const inscription: Inscription = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        number: 0,
        sat: '87654321',
        sat_ordinal: 'Sat 12345678',
        content_type: 'application/json',
        content: {}
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      
      // The sat property should be used, not sat_ordinal
      expect(resource.id).toBe('did:btco:87654321/0');
      expect(resource.sat).toBe('87654321');
    });

    // Test case 7: Test handling of numeric vs string sat values
    it('should handle both numeric and string sat values', () => {
      // Test with numeric sat
      const inscription1: Inscription = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        sat: 12345678,
        content_type: 'application/json',
        content: {}
      };
      
      const resource1 = createLinkedResourceFromInscription(inscription1, 'TestResource');
      expect(resource1.id).toBe('did:btco:12345678/0');
      expect(resource1.sat).toBe('12345678');
      
      // Test with string sat
      const inscription2: Inscription = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        sat: '87654321',
        content_type: 'application/json',
        content: {}
      };
      
      const resource2 = createLinkedResourceFromInscription(inscription2, 'TestResource');
      expect(resource2.id).toBe('did:btco:87654321/0');
      expect(resource2.sat).toBe('87654321');
    });

    // Test case 8: Error when sat_ordinal doesn't contain valid sat number
    it('should throw an error when sat_ordinal does not contain a valid sat number', () => {
      const inscription: Inscription = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        sat_ordinal: 'No valid number here',
        content_type: 'application/json',
        content: {}
      };
      
      expect(() => createLinkedResourceFromInscription(inscription, 'TestResource')).toThrow();
    });
  });

  describe('extractSatNumber', () => {
    it('should extract sat number from inscription with sat property', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content_type: 'application/json',
        content: {},
        sat: '1234567890'
      };
      
      const satNumber = extractSatNumber(inscription);
      expect(satNumber).toBe('1234567890');
    });

    it('should extract sat number from inscription with sat_ordinal property', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content_type: 'application/json',
        content: {},
        sat_ordinal: '1234567890i0'
      };
      
      const satNumber = extractSatNumber(inscription);
      expect(satNumber).toBe('1234567890');
    });

    it('should throw error when no sat info is available', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content_type: 'application/json',
        content: {},
        sat_ordinal: undefined
      };
      
      expect(() => extractSatNumber(inscription)).toThrow();
    });

    it('should handle numeric sat values', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content_type: 'application/json',
        content: {},
        sat: 1234567890
      };
      
      const satNumber = extractSatNumber(inscription);
      expect(satNumber).toBe('1234567890');
    });
  });
}); 