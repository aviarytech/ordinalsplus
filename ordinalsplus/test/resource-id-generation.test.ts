import { describe, expect, it } from 'bun:test';
import { createDidFromInscriptionData } from '../src/utils/validators';
import { Inscription } from '../src/types';

describe('Resource ID Generation', () => {
  describe('createDidFromInscriptionData', () => {
    it('should create a valid DID from inscription with sat', () => {
      const inscription: Inscription = {
        id: '123',
        sat: 1234567890,
        number: 0
      };

      const did = createDidFromInscriptionData(inscription);
      expect(did).toBe('did:btco:1234567890');
    });

    it('should throw error for invalid inscription without sat info', () => {
      const inscription: Partial<Inscription> = {
        id: '123',
        number: 0
      };

      expect(() => createDidFromInscriptionData(inscription as Inscription))
        .toThrow('Sat number is required');
    });

    it('should throw error for empty inscription', () => {
      expect(() => createDidFromInscriptionData({} as Inscription))
        .toThrow('Sat number is required');
    });
  });

  it('should generate a valid DID from inscription data', () => {
    const inscription: Inscription = {
      id: '123',
      content: { name: 'test' },
      sat: 1234567890,
      content_type: 'application/json',
      number: 0
    };
    const result = createDidFromInscriptionData(inscription);
    expect(result).toBe('did:btco:1234567890');
  });
}); 