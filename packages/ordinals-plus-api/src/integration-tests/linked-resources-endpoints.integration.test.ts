/**
 * Integration tests for linked resources API endpoints
 * 
 * Tests the hypothetical /api/linked-resources endpoints that would expose the 
 * linkedResourcesController functionality
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { createLinkedResource, getResourceByDid } from '../controllers/linkedResourcesController';
import type { LinkedResource } from '../types';

// Set test mode flag
process.env.TEST_MODE = 'true';

// Interface for create linked resource request
interface CreateLinkedResourceRequest {
  type: string;
  name?: string;
  description?: string;
  didReference?: string;
  [key: string]: any;
}

// Interface for error response
interface ErrorResponse {
  error: string;
  details?: any;
}

// Create a minimal test app for testing the API endpoints
const app = new Elysia()
  .onError(({ error }) => {
    console.error('API Error:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  })
  .post('/api/linked-resources', async ({ body, set }) => {
    try {
      // Type assertion for request body
      const typedBody = body as CreateLinkedResourceRequest;
      
      // Basic validation
      if (!typedBody.type) {
        set.status = 400;
        return { error: 'Resource must have a type property' };
      }
      
      // Extract didReference if present
      const { didReference, ...resourceData } = typedBody;
      
      // Call the controller function
      const result = await createLinkedResource(resourceData, didReference);
      
      set.status = 201; // Created
      return result;
    } catch (error) {
      set.status = 500;
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })
  .get('/api/linked-resources/did/:didId', async ({ params, set }) => {
    try {
      const { didId } = params;
      
      if (!didId) {
        set.status = 400;
        return { error: 'Missing required parameter: didId' };
      }
      
      const result = await getResourceByDid(didId);
      
      if (!result) {
        set.status = 404;
        return { error: `Resource with DID ${didId} not found` };
      }
      
      return result;
    } catch (error) {
      set.status = 500;
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

// Create a test server
let server: ReturnType<typeof app.listen>;
const testPort = 9877;
const baseUrl = `http://localhost:${testPort}`;

describe('Linked Resources API Endpoints', () => {
  beforeAll(() => {
    // Start the server for testing
    server = app.listen(testPort);
    console.log(`Test server started on port ${testPort}`);
  });

  afterAll(() => {
    // Clean up the server after tests
    if (server) {
      server.stop();
      console.log('Test server closed');
    }
  });

  describe('POST /api/linked-resources', () => {
    it('should create a linked resource when given valid data', async () => {
      // Arrange
      const validRequest: CreateLinkedResourceRequest = {
        type: 'TestResource',
        name: 'Integration Test Resource',
        description: 'Resource created during integration testing'
      };

      // Act
      const response = await fetch(`${baseUrl}/api/linked-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validRequest),
      });

      // Assert
      expect(response.status).toBe(201);
      
      // Parse response
      const result = await response.json() as LinkedResource;
      
      // Check response structure
      expect(result).toBeDefined();
      expect(result.id).toBeString();
      expect(result.id).toStartWith('did:btco:resource:');
      expect(result.type).toBe('TestResource');
      expect(result.content).toHaveProperty('name', 'Integration Test Resource');
    });

    it('should include didReference when provided', async () => {
      // Arrange
      const validRequest: CreateLinkedResourceRequest = {
        type: 'TestResource',
        name: 'Resource with DID Reference',
        didReference: 'did:btco:956424811897629'
      };

      // Act
      const response = await fetch(`${baseUrl}/api/linked-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validRequest),
      });

      // Assert
      expect(response.status).toBe(201);
      
      // Parse response
      const result = await response.json() as LinkedResource;
      
      // Check response structure
      expect(result).toBeDefined();
      expect(result.didReference).toBe('did:btco:956424811897629');
      expect(result.content).toHaveProperty('didReference', 'did:btco:956424811897629');
    });

    it('should return 400 when type is missing', async () => {
      // Arrange
      const invalidRequest = {
        name: 'Invalid Resource',
        description: 'Missing type field'
      };

      // Act
      const response = await fetch(`${baseUrl}/api/linked-resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidRequest),
      });

      // Assert
      expect(response.status).toBe(400);
      
      // Parse response
      const result = await response.json() as ErrorResponse;
      
      // Check error response
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Resource must have a type property');
    });
  });

  describe('GET /api/linked-resources/did/:didId', () => {
    it('should return a resource when given a valid DID', async () => {
      // Arrange
      const validDid = 'did:btco:resource:test';

      // Act
      const response = await fetch(`${baseUrl}/api/linked-resources/did/${validDid}`);

      // Assert
      expect(response.status).toBe(200);
      
      // Parse response
      const result = await response.json() as LinkedResource;
      
      // Check response structure
      expect(result).toBeDefined();
      expect(result.id).toBe(validDid);
      expect(result.type).toBe('Resource');
    });

    it('should return 404 when no resource is found for the DID', async () => {
      // This test relies on the implementation of getResourceByDid to return null for invalid DIDs
      // Arrange
      const invalidDid = 'invalid-did-format';

      // Act
      const response = await fetch(`${baseUrl}/api/linked-resources/did/${invalidDid}`);

      // Assert
      expect(response.status).toBe(404);
      
      // Parse response
      const result = await response.json() as ErrorResponse;
      
      // Check error response
      expect(result.error).toBeDefined();
      expect(result.error).toContain('not found');
    });
  });
}); 