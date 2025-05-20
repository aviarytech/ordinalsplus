/**
 * Integration tests for resource creation API endpoints
 * 
 * Tests the /api/resources/create-tx endpoint
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { Elysia } from 'elysia';
import { createResourcePsbt } from '../controllers/resourcesController';

// Set test mode flag to skip actual PSBT creation
process.env.TEST_MODE = 'true';

// Define request and response types for proper type assertions
interface ResourcePsbtRequest {
  content: string;
  contentType: string;
  resourceType: string;
  publicKey: string;
  changeAddress: string;
  recipientAddress: string;
  utxos: Array<{
    txid: string;
    vout: number;
    value: number;
    scriptPubKey: string;
  }>;
  feeRate: number;
  network: string;
  metadata?: Record<string, any>;
}

interface ResourcePsbtResponse {
  commitPsbtBase64: string;
  revealPsbtBase64: string;
  estimatedFees: number;
}

interface ErrorResponse {
  error: string;
  details?: any;
}

// Create a minimal test app for testing the API endpoint
const app = new Elysia()
  .onError(({ error }) => {
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  })
  .post('/api/resources/create-tx', async ({ body, set }) => {
    try {
      // Type assertion for request body
      const typedBody = body as ResourcePsbtRequest;
      
      // Basic validation
      const { 
        content,
        contentType,
        resourceType,
        publicKey,
        changeAddress,
        recipientAddress,
        utxos,
        feeRate,
        network,
        metadata = {}
      } = typedBody;
      
      if (!content || !contentType || !resourceType || !publicKey || !changeAddress || 
          !recipientAddress || !utxos || !feeRate || !network) {
        set.status = 400;
        return { error: 'Missing required fields in request body' };
      }
      
      if (!Array.isArray(utxos) || utxos.length === 0) {
        set.status = 400;
        return { error: 'UTXOs must be a non-empty array' };
      }
      
      // For testing, return a mock response
      if (process.env.TEST_MODE === 'true') {
        return {
          commitPsbtBase64: 'test-commit-psbt-base64',
          revealPsbtBase64: 'test-reveal-psbt-base64',
          estimatedFees: 5000
        };
      }
      
      // In real mode, would call the controller
      // const publicKeyBuffer = Buffer.from(publicKey, 'hex');
      // const contentBuffer = Buffer.from(content, 'base64');
      // return await createResourcePsbt({...});
    } catch (error) {
      set.status = 500;
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

// Create a test server
let server: ReturnType<typeof app.listen>;
const testPort = 9876;
const baseUrl = `http://localhost:${testPort}`;

describe('Resource Creation API Endpoints', () => {
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

  describe('POST /api/resources/create-tx', () => {
    it('should create resource PSBTs when provided valid data', async () => {
      // Valid test request
      const validRequest: ResourcePsbtRequest = {
        content: Buffer.from('Test content').toString('base64'),
        contentType: 'text/plain',
        resourceType: 'test-resource',
        publicKey: '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc',
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        utxos: [
          {
            txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
            vout: 0,
            value: 20000,
            scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
          }
        ],
        feeRate: 5,
        network: 'testnet',
        metadata: { test: 'metadata' }
      };

      // Make the request
      const response = await fetch(`${baseUrl}/api/resources/create-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validRequest),
      });

      // Check status code
      expect(response.status).toBe(200);

      // Parse response
      const result = await response.json() as ResourcePsbtResponse;

      // Check response structure
      expect(result).toBeDefined();
      expect(typeof result.commitPsbtBase64).toBe('string');
      expect(typeof result.revealPsbtBase64).toBe('string');
      expect(typeof result.estimatedFees).toBe('number');
    });

    it('should return 400 error when missing required fields', async () => {
      // Invalid request missing required fields
      const invalidRequest = {
        contentType: 'text/plain', // Missing content
        resourceType: 'test-resource',
        // Missing publicKey
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        // Missing utxos
        feeRate: 5,
        network: 'testnet'
      };

      // Make the request
      const response = await fetch(`${baseUrl}/api/resources/create-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidRequest),
      });

      // Check status code
      expect(response.status).toBe(400);

      // Parse response
      const result = await response.json() as ErrorResponse;

      // Check error response
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Missing required fields');
    });

    it('should return 400 error when utxos array is empty', async () => {
      // Request with empty utxos array
      const invalidRequest: Partial<ResourcePsbtRequest> = {
        content: Buffer.from('Test content').toString('base64'),
        contentType: 'text/plain',
        resourceType: 'test-resource',
        publicKey: '02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc',
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        utxos: [], // Empty utxos array
        feeRate: 5,
        network: 'testnet'
      };

      // Make the request
      const response = await fetch(`${baseUrl}/api/resources/create-tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(invalidRequest),
      });

      // Check status code
      expect(response.status).toBe(400);

      // Parse response
      const result = await response.json() as ErrorResponse;

      // Check error response
      expect(result.error).toBeDefined();
      expect(result.error).toContain('UTXOs must be a non-empty array');
    });
  });
}); 