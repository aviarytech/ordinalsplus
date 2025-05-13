/**
 * Unit tests for resourcesController
 * 
 * Tests the resource controller with properly mocked dependencies.
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as resourceCreation from '../../../../ordinalsplus/src/transactions/resource-creation';
import { createResourcePsbt } from '../resourcesController';

// Define a mock result to return from the createResourceTransaction function
const mockResult = {
  commitPsbtBase64: 'mocked-commit-psbt',
  revealPsbtBase64: 'mocked-reveal-psbt',
  estimatedFees: 5000,
};

describe('resourcesController', () => {
  // Save original console methods for restoration
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  let consoleOutput: string[] = [];
  
  // Create a spy for the createResourceTransaction function
  let createResourceTransactionSpy: any;
  
  // Setup mock params for testing
  let mockParams: any;
  
  beforeEach(() => {
    // Set up the spy
    createResourceTransactionSpy = spyOn(resourceCreation, 'createResourceTransaction');
    
    // Set the default implementation to return the mock result
    createResourceTransactionSpy.mockImplementation(async () => mockResult);
    
    // Mock console methods to capture output
    consoleOutput = [];
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(' '));
    };
    console.error = (...args: any[]) => {
      consoleOutput.push(`ERROR: ${args.join(' ')}`);
    };
    
    // Setup mock params for testing
    mockParams = {
      content: Buffer.from('Test content'),
      contentType: 'text/plain',
      resourceType: 'test-resource',
      publicKey: Buffer.from('02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc', 'hex'),
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
  });
  
  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('createResourcePsbt', () => {
    it('should pass through params and result correctly', async () => {
      // Act
      const result = await createResourcePsbt(mockParams);
        
      // Assert
      expect(consoleOutput.some(log => log.includes('[createResourcePsbt] Creating resource PSBT for network: testnet'))).toBe(true);
      expect(consoleOutput.some(log => log.includes('[createResourcePsbt] Successfully created resource PSBTs'))).toBe(true);
      
      // Verify the mock function was called with the correct params
      expect(createResourceTransactionSpy).toHaveBeenCalledWith(mockParams);
      
      // Verify we return the expected result
      expect(result).toEqual(mockResult);
    });
    
    it('should handle errors properly', async () => {
      // Arrange
      createResourceTransactionSpy.mockImplementation(async () => {
        throw new Error('Resource creation error');
      });
      
      // Act & Assert
      await expect(createResourcePsbt(mockParams)).rejects.toThrow();
      expect(consoleOutput.some(log => log.includes('[createResourcePsbt] Error creating resource PSBTs:'))).toBe(true);
    });
  });
}); 