/**
 * Integration tests for the refactored psbtService
 * 
 * Tests that the psbtService correctly interfaces with the ordinalsplus package.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { createInscriptionPsbts } from '../services/psbtService';
import type { CreatePsbtsRequest, Utxo, CombinedPsbtResponse } from '../types';

describe('PSBT Service Integration', () => {
  let testRequest: CreatePsbtsRequest;

  beforeEach(() => {
    // Mock UTXO for testing
    const mockUtxo: Utxo = {
      txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
      vout: 0,
      value: 20000,
      scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
    };

    // Create a test request
    testRequest = {
      contentType: 'text/plain',
      contentBase64: Buffer.from('Hello, Ordinals test!').toString('base64'),
      feeRate: 5,
      recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Testnet address
      utxos: [mockUtxo],
      changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Same address for simplicity
      networkType: 'testnet',
      testMode: true // Add testMode to skip finalization
    };
  });

  it('should generate valid PSBTs and signing material', async () => {
    // Skip this test in CI environments or when we want to avoid external calls
    const skipTest = process.env.CI === 'true';
    
    if (skipTest) {
      console.log('Skipping integration test in CI environment');
      return;
    }
    
    try {
      // Call the service function
      const result = await createInscriptionPsbts(testRequest);
      
      // Verify result has all expected fields
      expect(result).toBeDefined();
      expect(result.unsignedRevealPsbtBase64).toBeDefined();
      expect(result.revealSignerWif).toBeDefined();
      
      // Check data types and formats
      expect(typeof result.unsignedRevealPsbtBase64).toBe('string');
      expect(result.unsignedRevealPsbtBase64.length).toBeGreaterThan(50);
      
      // Optional: log result for debugging
      console.log('Integration test passed with result structure:', {
        revealPsbtLength: result.unsignedRevealPsbtBase64.length,
        hasWif: !!result.revealSignerWif,
      });
    } catch (error) {
      // If this fails in CI, we just log it rather than failing the test
      if (process.env.CI === 'true') {
        console.error('Integration test error (acceptable in CI):', error);
        return;
      }
      throw error;
    }
  });
}); 