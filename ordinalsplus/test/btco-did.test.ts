import { describe, expect, it, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { BtcoDid } from '../src/did/btco-did';
import { ApiClient } from '../src/utils/api-client';

// Mock the ApiClient class
const originalApiClient = ApiClient;
let getMock: ReturnType<typeof spyOn>;

// Setup mock before tests
beforeEach(() => {
  // Reset the ApiClient to restore the class
  (globalThis as any).ApiClient = function() {
    return {
      get: getMock = mock(async () => ({})),
      post: mock(async () => ({}))
    };
  };
});

describe('BtcoDid', () => {
  const validDid = 'did:btco:1234567890';
  
  describe('constructor', () => {
    it('should create a new BtcoDid instance with valid DID', () => {
      const did = new BtcoDid(validDid);
      expect(did).toBeInstanceOf(BtcoDid);
      expect(did.getDid()).toBe(validDid);
    });

    it('should throw an error for invalid DID', () => {
      expect(() => new BtcoDid('invalid:did')).toThrow();
      expect(() => new BtcoDid('did:wrong:12345')).toThrow();
      expect(() => new BtcoDid('did:btco:abc')).toThrow();
    });
  });

  describe('getDid', () => {
    it('should return the DID string', () => {
      const did = new BtcoDid(validDid);
      expect(did.getDid()).toBe(validDid);
    });
  });

  describe('getSatNumber', () => {
    it('should return the sat number as a string', () => {
      const did = new BtcoDid(validDid);
      expect(did.getSatNumber()).toBe('1234567890');
    });
  });

  describe('resolve', () => {
    it('should resolve a DID document', async () => {
      const mockDidDoc = {
        '@context': 'https://www.w3.org/ns/did/v1',
        id: validDid,
        verificationMethod: [],
        service: []
      };
      
      // Setup the mock response
      getMock.mockImplementation(async () => mockDidDoc);
      
      const did = new BtcoDid(validDid);
      const resolvedDoc = await did.resolve();
      
      expect(getMock).toHaveBeenCalled();
      expect(resolvedDoc).toEqual(mockDidDoc);
    });

    it('should throw an error when DID not found', async () => {
      // Setup the mock to throw an error
      getMock.mockImplementation(async () => {
        throw {
          error: 'notFound',
          message: 'DID not found'
        };
      });
      
      const did = new BtcoDid(validDid);
      
      await expect(did.resolve()).rejects.toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('not found')
      });
    });
  });

  // Restore the original ApiClient after all tests
  afterEach(() => {
    (globalThis as any).ApiClient = originalApiClient;
  });
}); 