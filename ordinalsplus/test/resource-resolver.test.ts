import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test';
import { ResourceResolver } from '../src/resources/resource-resolver.js';
import { ApiClient } from '../src/utils/api-client.js';

// Mock the ApiClient class
const originalApiClient = ApiClient;
let getMock: ReturnType<typeof mock>;

// Setup mock before tests
beforeEach(() => {
  // Create a new mock function
  getMock = mock(async () => ({}));
  
  // Reset the ApiClient to restore the class
  (globalThis as any).ApiClient = function() {
    return {
      get: getMock,
      post: mock(async () => ({}))
    };
  };
});

describe('ResourceResolver', () => {
  const validResourceId = 'did:btco:1234567890/0';
  
  describe('constructor', () => {
    it('should create a new ResourceResolver instance', () => {
      const resolver = new ResourceResolver();
      expect(resolver).toBeInstanceOf(ResourceResolver);
    });

    it('should accept API options', () => {
      const resolver = new ResourceResolver({ endpoint: 'https://custom-api.example.com' });
      expect(resolver).toBeInstanceOf(ResourceResolver);
      // Implementation detail: we can't easily test if the options were passed to the ApiClient
      // since we've mocked it completely, but at least we can verify it doesn't throw
    });
  });

  describe('resolve', () => {
    it('should resolve a resource by ID', async () => {
      const mockContent = { key: 'value' };
      
      // Setup the mock response
      getMock.mockImplementation(async () => mockContent);
      
      const resolver = new ResourceResolver();
      const result = await resolver.resolve(validResourceId);
      
      expect(getMock).toHaveBeenCalled();
      expect(result).toMatchObject({
        content: mockContent,
        contentType: 'application/json'
      });
    });

    it('should detect content type for text content', async () => {
      const htmlContent = '<!DOCTYPE html><html><body>Test</body></html>';
      
      // Setup the mock response
      getMock.mockImplementation(async () => htmlContent);
      
      const resolver = new ResourceResolver();
      const result = await resolver.resolve(validResourceId);
      
      expect(result).toMatchObject({
        content: htmlContent,
        contentType: 'text/html'
      });
    });

    it('should throw an error for invalid resource ID', async () => {
      const resolver = new ResourceResolver();
      
      await expect(resolver.resolve('invalid-id')).rejects.toMatchObject({
        error: expect.any(String),
        message: expect.stringContaining('Invalid resource identifier')
      });
    });
  });

  describe('resolveInfo', () => {
    it('should resolve resource information', async () => {
      const mockInfo = {
        id: validResourceId,
        created: '2023-01-01T00:00:00Z',
        updated: '2023-01-02T00:00:00Z',
        contentType: 'application/json',
        resourceUri: validResourceId,
        resourceCollectionId: validResourceId,
        resourceId: validResourceId,
        resourceName: validResourceId,
        resourceType: validResourceId,
        mediaType: 'application/json'
      };
      
      // Setup the mock response
      getMock.mockImplementation(async () => mockInfo);
      
      const resolver = new ResourceResolver();
      const result = await resolver.resolveInfo(validResourceId);
      
      expect(getMock).toHaveBeenCalled();
      expect(result).toEqual(mockInfo);
    });
  });

  describe('resolveCollection', () => {
    it('should resolve a collection with default parameters', async () => {
      const mockCollection = {
        items: [],
        total: 0,
        nextCursor: null,
        resources: [],
        pagination: {
          nextCursor: null,
          total: 0,
          limit: 10
        }
      };
      
      // Setup the mock response
      getMock.mockImplementation(async () => mockCollection);
      
      const resolver = new ResourceResolver();
      const result = await resolver.resolveCollection(validResourceId);
      
      expect(getMock).toHaveBeenCalled();
      expect(result).toEqual(mockCollection);
    });

    it('should handle pagination parameters', async () => {
      const mockCollection = {
        items: [],
        total: 100,
        nextCursor: 'next-page-token',
        resources: [],
        pagination: {
          nextCursor: 'next-page-token',
          total: 100,
          limit: 10
        }
      };
      
      // Setup the mock response
      getMock.mockImplementation(async () => mockCollection);
      
      const resolver = new ResourceResolver();
      const result = await resolver.resolveCollection(validResourceId, 20, 'page-token');
      
      expect(getMock).toHaveBeenCalled();
      expect(result).toEqual(mockCollection);
    });
  });

  // Restore the original ApiClient after all tests
  afterEach(() => {
    (globalThis as any).ApiClient = originalApiClient;
  });
}); 