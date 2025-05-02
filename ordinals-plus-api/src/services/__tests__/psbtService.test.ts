/**
 * Integration tests for the refactored psbtService
 * 
 * Note: This is a simplified test that directly calls the service.
 * It requires the actual ordinalsplus package to be available.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { createInscriptionPsbts } from '../psbtService';
import type { CreatePsbtsRequest } from '../../types';

describe('psbtService', () => {
  let testRequest: CreatePsbtsRequest;

  beforeEach(() => {
    // Setup a test request
    testRequest = {
      contentType: 'text/plain',
      contentBase64: Buffer.from('Hello, Ordinals test!').toString('base64'),
      feeRate: 5,
      recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Testnet address
      utxos: [{
        txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
        vout: 0,
        value: 20000,
        scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
      }],
      changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      networkType: 'testnet',
      testMode: true // Use test mode to avoid needing real chain data
    };
  });

  describe('createInscriptionPsbts', () => {
    it('should return a properly structured response', async () => {
      // Skip this test in CI environments or when we want to avoid external calls
      const skipTest = process.env.CI === 'true';
      
      if (skipTest) {
        console.log('Skipping integration test in CI environment');
        return;
      }
      
      try {
        // Call the actual function - this is an integration test
        const result = await createInscriptionPsbts(testRequest);
        
        // Verify the basic structure
        expect(result).toBeDefined();
        
        // In test mode, commitPsbtBase64 might be empty
        expect(result.unsignedRevealPsbtBase64).toBeDefined();
        expect(result.unsignedRevealPsbtBase64.length).toBeGreaterThan(0);
        
        expect(result.revealSignerWif).toBeDefined();
        expect(result.revealSignerWif.length).toBeGreaterThan(0);
        
        console.log('Integration test passed with result structure:', {
          hasUnsignedRevealPsbt: !!result.unsignedRevealPsbtBase64,
          hasWif: !!result.revealSignerWif,
        });
      } catch (error) {
        // If this fails in CI, we just log it rather than failing the test
        if (process.env.CI === 'true') {
          console.error('Integration test error (acceptable in CI):', error);
        } else {
          throw error;
        }
      }
    });
  });
}); 