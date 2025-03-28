import { describe, expect, it } from 'bun:test';
import { isValidBtcoDid, isValidResourceId, parseBtcoDid, parseResourceId } from '../src/utils/validators';

describe('Validators', () => {
  describe('isValidBtcoDid', () => {
    it('should return true for valid BTCO DIDs', () => {
      expect(isValidBtcoDid('did:btco:1234567890')).toBe(true);
      expect(isValidBtcoDid('did:btco:0')).toBe(true);
      expect(isValidBtcoDid('did:btco:2099999997690000')).toBe(true);
    });

    it('should return false for invalid BTCO DIDs', () => {
      expect(isValidBtcoDid('did:wrong:1234567890')).toBe(false);
      expect(isValidBtcoDid('notadid')).toBe(false);
      expect(isValidBtcoDid('did:btco:abc')).toBe(false);
      expect(isValidBtcoDid('did:btco:-123')).toBe(false);
      expect(isValidBtcoDid('did:btco:3099999997690000')).toBe(false); // Too large
    });
  });

  describe('parseBtcoDid', () => {
    it('should correctly parse valid BTCO DIDs', () => {
      expect(parseBtcoDid('did:btco:1234567890')).toEqual({
        method: 'btco',
        satNumber: '1234567890'
      });
    });

    it('should return null for invalid BTCO DIDs', () => {
      expect(parseBtcoDid('did:wrong:1234567890')).toBeNull();
      expect(parseBtcoDid('notadid')).toBeNull();
    });
  });

  describe('isValidResourceId', () => {
    it('should return true for valid resource IDs', () => {
      expect(isValidResourceId('did:btco:1234567890/0')).toBe(true);
      expect(isValidResourceId('did:btco:1234567890/123')).toBe(true);
      expect(isValidResourceId('did:btco:1234567890')).toBe(true); // DIDs without index are also valid resource IDs
    });

    it('should return false for invalid resource IDs', () => {
      expect(isValidResourceId('did:wrong:1234567890/0')).toBe(false);
      expect(isValidResourceId('did:btco:1234567890/')).toBe(false); // Missing index value
      expect(isValidResourceId('did:btco:1234567890/abc')).toBe(false); // Non-numeric index
      expect(isValidResourceId('did:btco:1234567890/0/0')).toBe(false); // Old format with extra segment
    });
  });

  describe('parseResourceId', () => {
    it('should correctly parse valid resource IDs', () => {
      expect(parseResourceId('did:btco:1234567890/0')).toEqual({
        did: 'did:btco:1234567890/0'
      });
      
      expect(parseResourceId('did:btco:1234567890')).toEqual({
        did: 'did:btco:1234567890'
      });
    });

    it('should return null for invalid resource IDs', () => {
      expect(parseResourceId('did:wrong:1234567890/0')).toBeNull();
      expect(parseResourceId('did:btco:1234567890/0/0')).toBeNull(); // Old format
      expect(parseResourceId('notaresourceid')).toBeNull();
    });
  });
}); 