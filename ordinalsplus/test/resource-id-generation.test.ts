import { describe, expect, it } from 'bun:test';
import { createDidFromInscriptionData } from '../src/utils/validators';
import { Inscription } from '../src/types';

describe('Resource ID Generation', () => {
  describe('createDidFromInscriptionData', () => {
    it('should create a valid DID from inscription with sat', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content_type: 'text/plain',
        content: 'test',
        sat: '1234567890'
      };
      
      const did = createDidFromInscriptionData(inscription);
      expect(did).toBe('did:btco:1234567890/0');
    });

    it('should create a valid DID from inscription with sat_ordinal', () => {
      const inscription: Inscription = {
        id: '123',
        number: 0,
        content_type: 'text/plain',
        content: 'test',
        sat_ordinal: '1234567890i0'
      };
      
      const did = createDidFromInscriptionData(inscription);
      expect(did).toBe('did:btco:1234567890/0');
    });

    it('should throw error for invalid inscription without sat info', () => {
      const inscription = {
        id: '123'
      };
      
      expect(() => createDidFromInscriptionData(inscription as Inscription)).toThrow();
    });

    it('should throw error for empty inscription', () => {
      const inscription = {};
      
      expect(() => createDidFromInscriptionData(inscription as Inscription)).toThrow();
    });
  });
}); 