import { describe, expect, it } from 'bun:test';
import { createLinkedResourceFromInscription } from '../src/did/did-utils';
import { Inscription } from '../src/types';
import { extractSatNumber } from '../src/utils/validators.js';

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
          content: {},
          number: testCase.expectedIndex
        };
        const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
        // The resource ID should include the correct index
        expect(resource.id).toBe(`did:btco:87654321/${testCase.expectedIndex}`);
        // The DID reference should not include the index
        expect(resource.didReference).toBe('did:btco:87654321');
      });
    });

    it('should use number property when no index in ID', () => {
      const inscription: Inscription = {
        id: 'abc123',
        number: 123,
        sat: 87654321,
        content_type: 'application/json',
        content: { value: {} }
      };
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      // Should use the number property as index
      expect(resource.id).toBe('did:btco:87654321/123');
      // The DID reference should not include the index
      expect(resource.didReference).toBe('did:btco:87654321');
    });

    it('should throw an error when no index in ID and no number property', () => {
      const inscription: Partial<Inscription> = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fd',
        sat: 87654321,
        content_type: 'application/json',
        content: { value: {} }
      };
      // Should throw error because there's no inscription index in ID and no number property
      expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'TestResource'))
        .toThrow('No valid index found in inscription');
    });

    it('should throw an error when no sat or sat_ordinal information is available', () => {
      const inscription: Partial<Inscription> = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        content_type: 'application/json',
        content: { value: {} }
      };
      // Check that it throws an error now instead of falling back
      expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'TestResource'))
        .toThrow('Sat number is required');
    });

    it('should prioritize sat over sat_ordinal when both are present', () => {
      const inscription: Inscription = {
        id: '123',
        sat: 87654321,
        sat_ordinal: '99999999',
        content_type: 'application/json',
        content: {},
        number: 0
      };
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      // The sat property should be used, not sat_ordinal
      expect(resource.id).toBe('did:btco:87654321/0');
      // The DID reference should not include the index
      expect(resource.didReference).toBe('did:btco:87654321');
    });

    it('should handle both numeric and string sat values', () => {
      const inscription1: Inscription = {
        id: '123',
        sat: 12345678,
        content_type: 'application/json',
        content: { value: {} },
        number: 0
      };
      const resource1 = createLinkedResourceFromInscription(inscription1, 'TestResource');
      expect(resource1.id).toBe('did:btco:12345678/0');
      expect(resource1.didReference).toBe('did:btco:12345678');

      const inscription2: Inscription = {
        id: '456',
        sat: 87654321,
        content_type: 'application/json',
        content: { value: {} },
        number: 0
      };
      const resource2 = createLinkedResourceFromInscription(inscription2, 'TestResource');
      expect(resource2.id).toBe('did:btco:87654321/0');
      expect(resource2.didReference).toBe('did:btco:87654321');
    });

    it('should throw an error when sat_ordinal does not contain a valid sat number', () => {
      const inscription: Partial<Inscription> = {
        id: '152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0',
        sat: 0, // Invalid sat number
        content_type: 'application/json',
        content: { value: {} }
      };
      expect(() => createLinkedResourceFromInscription(inscription as Inscription, 'TestResource'))
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
        content: { value: {} }
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
        content: { value: {} }
      };
      
      expect(() => extractSatNumber(inscription)).toThrow();
    });

    it('should throw error when sat number is invalid', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        sat: 0, // Invalid sat number
        content_type: 'application/json',
        content: { value: {} }
      };
      
      expect(() => extractSatNumber(inscription)).toThrow();
    });
  });

  describe('Content Extraction', () => {
    describe('JSON Content', () => {
      it('should extract JSON content from inscription', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: { name: 'Test Resource', description: 'A test resource' },
          sat: 87654321,
          content_type: 'application/json'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: { value: { name: 'Test Resource', description: 'A test resource' } },
          contentType: 'application/json',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });

      it('should handle empty JSON content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: {},
          sat: 87654321,
          content_type: 'application/json'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: { value: {} },
          contentType: 'application/json',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });

      it('should handle null JSON content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: null,
          sat: 87654321,
          content_type: 'application/json'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: { value: null },
          contentType: 'application/json',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });
    });

    describe('Text Content', () => {
      it('should extract text content from inscription', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: 'Hello, World!',
          sat: 87654321,
          content_type: 'text/plain'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: 'Hello, World!'
          },
          contentType: 'text/plain',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });

      it('should handle empty text content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: '',
          sat: 87654321,
          content_type: 'text/plain'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: ''
          },
          contentType: 'text/plain',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });
    });

    describe('Binary Content', () => {
      it('should handle image content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: 'base64-encoded-image-data',
          sat: 12345678,
          content_type: 'image/png'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: 'base64-encoded-image-data'
          },
          contentType: 'image/png',
          id: 'did:btco:12345678/0',
          didReference: 'did:btco:12345678',
          inscriptionId: '123',
          sat: 12345678,
          type: 'test-type'
        });
      });

      it('should handle audio content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: 'base64-encoded-audio-data',
          sat: 87654321,
          content_type: 'audio/mp3'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: 'base64-encoded-audio-data'
          },
          contentType: 'audio/mp3',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });

      it('should handle video content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: 'base64-encoded-video-data',
          sat: 87654321,
          content_type: 'video/mp4'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: 'base64-encoded-video-data'
          },
          contentType: 'video/mp4',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle missing content type', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: 'test',
          sat: 1234567890
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: 'test'
          },
          contentType: 'application/json',
          id: 'did:btco:1234567890/0',
          didReference: 'did:btco:1234567890',
          inscriptionId: '123',
          sat: 1234567890,
          type: 'test-type'
        });
      });

      it('should handle undefined content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          sat: 1234567890,
          content_type: 'text/plain'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: null
          },
          contentType: 'text/plain',
          id: 'did:btco:1234567890/0',
          didReference: 'did:btco:1234567890',
          inscriptionId: '123',
          sat: 1234567890,
          type: 'test-type'
        });
      });

      it('should handle missing content', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          sat: 87654321,
          content_type: 'application/json'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: null
          },
          contentType: 'application/json',
          id: 'did:btco:87654321/0',
          didReference: 'did:btco:87654321',
          inscriptionId: '123',
          sat: 87654321,
          type: 'test-type'
        });
      });

      it('should handle custom content type', () => {
        const inscription: Inscription = {
          id: '123',
          number: 0,
          content: 'custom data',
          sat: 1234567890,
          content_type: 'application/x-custom'
        };
        
        const result = createLinkedResourceFromInscription(inscription, 'test-type');
        expect(result).toEqual({
          content: {
            value: 'custom data'
          },
          contentType: 'application/x-custom',
          id: 'did:btco:1234567890/0',
          didReference: 'did:btco:1234567890',
          inscriptionId: '123',
          sat: 1234567890,
          type: 'test-type'
        });
      });
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content correctly', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: { value: { name: 'test', description: 'test description' } },
        sat: 87654321,
        content_type: 'application/json'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: { name: 'test', description: 'test description' } });
    });

    it('should handle empty object content', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: { value: {} },
        sat: 87654321,
        content_type: 'application/json'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: {} });
    });

    it('should handle null content', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: { value: null },
        sat: 87654321,
        content_type: 'application/json'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: null });
    });

    it('should handle string content that looks like JSON', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: '{"test": "value"}',
        sat: 87654321,
        content_type: 'application/json'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: '{"test": "value"}' });
    });

    it('should handle invalid JSON string content', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: '{invalid json}',
        sat: 87654321,
        content_type: 'application/json'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: '{invalid json}' });
    });

    it('should handle plain text content', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: 'Hello, world!',
        sat: 87654321,
        content_type: 'text/plain'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: 'Hello, world!' });
    });

    it('should handle HTML content', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: '<h1>Hello</h1>',
        sat: 87654321,
        content_type: 'text/html'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: '<h1>Hello</h1>' });
    });

    it('should handle SVG content', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: '<svg></svg>',
        sat: 87654321,
        content_type: 'image/svg+xml'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: '<svg></svg>' });
    });

    it('should handle binary content', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content: 'binary data',
        sat: 87654321,
        content_type: 'application/octet-stream'
      };
      
      const resource = createLinkedResourceFromInscription(inscription, 'TestResource');
      expect(resource.content).toEqual({ value: 'binary data' });
    });
  });
}); 