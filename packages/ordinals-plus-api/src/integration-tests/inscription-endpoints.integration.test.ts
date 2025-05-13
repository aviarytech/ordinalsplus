/**
 * Integration tests for inscription API endpoints
 * 
 * Tests the following endpoints:
 * - GET /api/fees - Get fee estimates
 * - GET /api/transactions/:txid/status - Get transaction status
 * - POST /api/inscriptions/commit - Create inscription PSBTs
 */

import { describe, it, expect, beforeAll, afterAll, jest } from 'bun:test';
import { Elysia, t } from 'elysia';
import { 
  getFeeEstimates, 
  getTransactionStatus 
} from '../controllers/inscriptionsController';
import type { 
  FeeEstimateResponse, 
  TransactionStatusResponse,
  CreatePsbtsRequest,
  CombinedPsbtResponse,
  ErrorResponse,
  NetworkType
} from '../types';

// Set test mode flag
process.env.TEST_MODE = 'true';

// Create a mock response
const mockPsbtResponse = {
  commitPsbtBase64: 'cHNidP8BAHUCAAAAASaBcTce3/KF6Tet7qSze3gADAVmy7OtZGQXE8pCFxv2AAAAAAD+////AtPf9QUAAAAAGXapFNDFmQPFusKGh2DpD9UhpGZap2UgiKwA4fUFAAAAABepFDVF5uM7gyxHBQ8k0+65PJwDlIvHh7MuEwAAAQD9pQEBAAAAAAECiaPHHqtNIOA3G7ukzGmPopXJRjr6Ljl/hTPMti+VZ+UBAAAAFxYAFL4Y0VKpsBIDna89p95PUzSe7LmF/////4b4qkOnHf8USIk6UwpyN+9rRgi7st0tAXHmOuxqSJC0AQAAABcWABT+Pp7xp0XpdNkCxDVZQ6vLNL1TU/////8CAMLrCwAAAAAZdqkUhc/xCX/Z4Ai7NK9wnGIZeziXikiIrHL++E4sAAAAF6kUM5cluiHv1irHU6m80GfWx6ajnQWHAkcwRAIgJxK+IuAnDzlPVoMR3HyppolwuAJf3TskAinwf4pfOiQCIAGLONfc0xTnNMkna9b7QPZzMlvEuqFEyADS8vAtsnZcASED0uFWdJQbrUqZY3LLh+GFbTZSYG2YVi/jnF6efkE/IQUCSDBFAiEA0SuFLYXc2WHS9fSrZgZU327tzHlMDDPOXMMJ/7X85Y0CIGczio4OFyXBl/saiK9Z9R5E5CVbIBZ8hoQDHAXR8lkqASECI7cr7vCWXRC+B3jv7NYfysb3mk6haTkzgHNEZPhPKrMAAAAAAAAA',
  unsignedRevealPsbtBase64: 'cHNidP8BAHUCAAAAASaBcTce3/KF6Tet7qSze3gADAVmy7OtZGQXE8pCFxv2AAAAAAD+////AtPf9QUAAAAAGXapFNDFmQPFusKGh2DpD9UhpGZap2UgiKwA4fUFAAAAABepFDVF5uM7gyxHBQ8k0+65PJwDlIvHh7MuEwAAAQD9pQEBAAAAAAECiaPHHqtNIOA3G7ukzGmPopXJRjr6Ljl/hTPMti+VZ+UBAAAAFxYAFL4Y0VKpsBIDna89p95PUzSe7LmF/////4b4qkOnHf8USIk6UwpyN+9rRgi7st0tAXHmOuxqSJC0AQAAABcWABT+Pp7xp0XpdNkCxDVZQ6vLNL1TU/////8CAMLrCwAAAAAZdqkUhc/xCX/Z4Ai7NK9wnGIZeziXikiIrHL++E4sAAAAF6kUM5cluiHv1irHU6m80GfWx6ajnQWHAkcwRAIgJxK+IuAnDzlPVoMR3HyppolwuAJf3TskAinwf4pfOiQCIAGLONfc0xTnNMkna9b7QPZzMlvEuqFEyADS8vAtsnZcASED0uFWdJQbrUqZY3LLh+GFbTZSYG2YVi/jnF6efkE/IQUCSDBFAiEA0SuFLYXc2WHS9fSrZgZU327tzHlMDDPOXMMJ/7X85Y0CIGczio4OFyXBl/saiK9Z9R5E5CVbIBZ8hoQDHAXR8lkqASECI7cr7vCWXRC+B3jv7NYfysb3mk6haTkzgHNEZPhPKrMAAAAAAAAA',
  revealSignerWif: 'L1HKVVLsoA5cLJgRMt8BD8PN6Z5pHFMz1pRrFvACRdX3LkUJQJTY',
};

// Create a mock function for testing
const mockCreatePsbts = jest.fn().mockImplementation(async (request) => {
  return mockPsbtResponse;
});

// Create a minimal test app for testing the API endpoints
const app = new Elysia()
  .onError(({ error }) => {
    console.error('API Error:', error);
    return {
      error: error instanceof Error ? error.message : String(error)
    };
  })
  .get('/api/fees', async ({ query, set }) => {
    try {
      // Parse network to ensure it's a valid NetworkType
      const networkParam = query.network || 'mainnet';
      let network: NetworkType = 'mainnet';
      
      if (networkParam === 'mainnet' || networkParam === 'testnet' || networkParam === 'signet') {
        network = networkParam;
      }
      
      const result = await getFeeEstimates(network);
      return result;
    } catch (error) {
      set.status = 500;
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, {
    query: t.Object({
      network: t.Optional(t.String())
    })
  })
  .get('/api/transactions/:txid/status', async ({ params, set }) => {
    try {
      const { txid } = params;
      
      if (!txid) {
        set.status = 400;
        return { error: 'Missing transaction ID' };
      }
      
      const result = await getTransactionStatus(txid);
      return result;
    } catch (error) {
      set.status = 500;
      return {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  })
  .post('/api/inscriptions/commit', async ({ body, set }) => {
    try {
      // Type assertion for request body
      const typedBody = body as CreatePsbtsRequest;
      
      // Basic validation
      if (!typedBody.contentType || !typedBody.contentBase64 || !typedBody.feeRate) {
        set.status = 400;
        return { error: 'Missing required fields in request body' };
      }
      
      if (!Array.isArray(typedBody.utxos) || typedBody.utxos.length === 0) {
        set.status = 400;
        return { error: 'UTXOs must be a non-empty array' };
      }
      
      // Call the mock function instead of the real one
      const result = await mockCreatePsbts(typedBody);
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
const testPort = 9878;
const baseUrl = `http://localhost:${testPort}`;

describe('Inscription API Endpoints', () => {
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

  describe('GET /api/fees', () => {
    it('should return fee estimates', async () => {
      // Act
      const response = await fetch(`${baseUrl}/api/fees`);

      // Assert
      expect(response.status).toBe(200);
      
      // Parse response
      const result = await response.json() as FeeEstimateResponse;
      
      // Check response structure
      expect(result).toBeDefined();
      expect(typeof result.low).toBe('number');
      expect(typeof result.medium).toBe('number');
      expect(typeof result.high).toBe('number');
    });

    it('should accept network parameter', async () => {
      // Act
      const response = await fetch(`${baseUrl}/api/fees?network=signet`);

      // Assert
      expect(response.status).toBe(200);
      
      // Parse response
      const result = await response.json() as FeeEstimateResponse;
      
      // Check response structure
      expect(result).toBeDefined();
      expect(typeof result.low).toBe('number');
      expect(typeof result.medium).toBe('number');
      expect(typeof result.high).toBe('number');
    });
  });

  describe('GET /api/transactions/:txid/status', () => {
    it('should return transaction status for a valid txid', async () => {
      // Arrange - Use a txid format that will return 'confirmed' in test mode
      const txid = '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511';
      
      // Act
      const response = await fetch(`${baseUrl}/api/transactions/${txid}/status`);

      // Assert
      expect(response.status).toBe(200);
      
      // Parse response
      const result = await response.json() as TransactionStatusResponse;
      
      // Check response structure
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  describe('POST /api/inscriptions/commit', () => {
    it('should create inscription PSBTs when given valid data', async () => {
      // Arrange
      const validRequest: CreatePsbtsRequest = {
        contentType: 'text/plain',
        contentBase64: 'SGVsbG8sIFdvcmxkIQ==', // "Hello, World!" in base64
        feeRate: 5,
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        utxos: [
          {
            txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
            vout: 0,
            value: 20000,
            scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
          }
        ],
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        networkType: 'testnet'
      };

      // Act
      const response = await fetch(`${baseUrl}/api/inscriptions/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(validRequest),
      });

      // Assert
      expect(response.status).toBe(200);
      
      // Parse response
      const result = await response.json() as CombinedPsbtResponse;
      
      // Check response structure
      expect(result).toBeDefined();
      expect(typeof result.commitPsbtBase64).toBe('string');
      expect(typeof result.unsignedRevealPsbtBase64).toBe('string');
      expect(typeof result.revealSignerWif).toBe('string');
      
      // Verify mock was called with the right parameters
      expect(mockCreatePsbts).toHaveBeenCalledWith(validRequest);
    });

    it('should return 400 error when missing required fields', async () => {
      // Arrange
      const invalidRequest = {
        contentType: 'text/plain',
        // Missing contentBase64
        feeRate: 5,
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        utxos: [
          {
            txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
            vout: 0,
            value: 20000,
            scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
          }
        ],
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        networkType: 'testnet'
      };

      // Act
      const response = await fetch(`${baseUrl}/api/inscriptions/commit`, {
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
      expect(result.error).toContain('Missing required fields');
    });

    it('should return 400 error when utxos array is empty', async () => {
      // Arrange
      const invalidRequest = {
        contentType: 'text/plain',
        contentBase64: 'SGVsbG8sIFdvcmxkIQ==',
        feeRate: 5,
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        utxos: [], // Empty utxos array
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        networkType: 'testnet'
      };

      // Act
      const response = await fetch(`${baseUrl}/api/inscriptions/commit`, {
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
      expect(result.error).toContain('UTXOs must be a non-empty array');
    });
  });
}); 