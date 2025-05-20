import { describe, expect, it } from 'bun:test';
import { isValidResourceId, parseResourceId } from '../src/utils/validators';

describe('Resource ID Validators', () => {
  describe('isValidResourceId', () => {
    it('should return true for valid resource IDs with different formats', () => {
      // Standard format: did:btco:<sat>/<index>
      expect(isValidResourceId('did:btco:1234567890/0')).toBe(true);
      expect(isValidResourceId('did:btco:1234567890/123')).toBe(true);
      expect(isValidResourceId('did:btco:1234567890/999999')).toBe(true);
    });

    it('should return false for invalid resource IDs', () => {
      // Invalid method
      expect(isValidResourceId('did:wrong:1234567890/0')).toBe(false);
      // Invalid format with extra segments
      expect(isValidResourceId('did:btco:1234567890/0/0')).toBe(false);
      // Missing index
      expect(isValidResourceId('did:btco:1234567890')).toBe(false);
      // Invalid characters
      expect(isValidResourceId('did:btco:abc/0')).toBe(false);
      // Negative index
      expect(isValidResourceId('did:btco:1234567890/-1')).toBe(false);
      // Too large sat number
      expect(isValidResourceId('did:btco:3099999997690000/0')).toBe(false);
    });
  });

  describe('parseResourceId', () => {
    it('should correctly parse valid resource IDs', () => {
      // Standard format
      expect(parseResourceId('did:btco:1234567890/0')).toEqual({
        did: 'did:btco:1234567890',
        satNumber: '1234567890',
        index: 0
      });

      expect(parseResourceId('did:btco:1234567890/123')).toEqual({
        did: 'did:btco:1234567890',
        satNumber: '1234567890',
        index: 123
      });
    });

    it('should return null for invalid resource IDs', () => {
      // Invalid method
      expect(parseResourceId('did:wrong:1234567890/0')).toBeNull();
      // Invalid format with extra segments
      expect(parseResourceId('did:btco:1234567890/0/0')).toBeNull();
      // Missing index
      expect(parseResourceId('did:btco:1234567890')).toBeNull();
      // Invalid characters
      expect(parseResourceId('did:btco:abc/0')).toBeNull();
      // Negative index
      expect(parseResourceId('did:btco:1234567890/-1')).toBeNull();
      // Too large sat number
      expect(parseResourceId('did:btco:3099999997690000/0')).toBeNull();
    });
  });
}); 