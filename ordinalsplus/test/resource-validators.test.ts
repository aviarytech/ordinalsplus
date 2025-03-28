import { describe, expect, it } from 'bun:test';
import { isValidResourceId, parseResourceId } from '../src/utils/validators';

describe('Resource ID Validators', () => {
  describe('isValidResourceId', () => {
    it('should return true for valid resource IDs with different formats', () => {
      // Standard format: did:btco:<sat>/<index>
      expect(isValidResourceId('did:btco:1234567890/0')).toBe(true);
      expect(isValidResourceId('did:btco:1234567890/999')).toBe(true);
      
      // Without index
      expect(isValidResourceId('did:btco:1234567890')).toBe(true);
    });

    it('should return false for invalid resource IDs', () => {
      // Invalid method
      expect(isValidResourceId('did:wrong:1234567890/0')).toBe(false);
      
      // Invalid format with extra segments
      expect(isValidResourceId('did:btco:1234567890/0/0')).toBe(false);
      expect(isValidResourceId('did:btco:1234567890/0/info')).toBe(false);
      
      // Non-numeric values
      expect(isValidResourceId('did:btco:abc/0')).toBe(false);
      expect(isValidResourceId('did:btco:1234567890/abc')).toBe(false);
      
      // Completely wrong format
      expect(isValidResourceId('notaresourceid')).toBe(false);
      expect(isValidResourceId('resource:btco:1234')).toBe(false);
    });
  });

  describe('parseResourceId', () => {
    it('should correctly parse valid resource IDs', () => {
      // Standard format
      expect(parseResourceId('did:btco:1234567890/0')).toEqual({
        did: 'did:btco:1234567890/0'
      });
      
      // Without index
      expect(parseResourceId('did:btco:1234567890')).toEqual({
        did: 'did:btco:1234567890'
      });
    });

    it('should return null for invalid resource IDs', () => {
      // Invalid method
      expect(parseResourceId('did:wrong:1234567890/0')).toBeNull();
      
      // Invalid format with extra segments
      expect(parseResourceId('did:btco:1234567890/0/0')).toBeNull();
      expect(parseResourceId('did:btco:1234567890/0/info')).toBeNull();
      
      // Completely wrong format
      expect(parseResourceId('notaresourceid')).toBeNull();
    });
  });
}); 