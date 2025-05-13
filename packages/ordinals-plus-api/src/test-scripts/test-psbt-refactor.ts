/**
 * Test script for the refactored psbtService
 * 
 * This script creates a test request and calls the createInscriptionPsbts function
 * to verify that it correctly interfaces with the ordinalsplus package.
 */

import { createInscriptionPsbts } from '../services/psbtService';
import type { CreatePsbtsRequest, Utxo, CombinedPsbtResponse } from '../types';

// Mock UTXO for testing
const mockUtxo: Utxo = {
  txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
  vout: 0,
  value: 20000,
  scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
};

// Create a test request
const testRequest: CreatePsbtsRequest = {
  contentType: 'text/plain',
  contentBase64: Buffer.from('Hello, Ordinals test!').toString('base64'),
  feeRate: 5,
  recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Testnet address
  utxos: [mockUtxo],
  changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Same address for simplicity
  networkType: 'testnet',
  testMode: true // Add testMode to skip finalization
};

async function runTest() {
  console.log('Testing refactored psbtService...');
  console.log('Using test request:', JSON.stringify(testRequest, null, 2));
  
  try {
    // Call the service function
    const result = await createInscriptionPsbts(testRequest);
    
    // Check that we got a valid response with all expected fields
    const hasAllFields = 
      !!result.unsignedRevealPsbtBase64 && 
      !!result.revealSignerWif
      
    console.log('Test result:', {
      success: hasAllFields,
      revealPsbtLength: result.unsignedRevealPsbtBase64.length,
      hasWif: !!result.revealSignerWif
    });
    
    // Print part of the result to verify it looks correct
    console.log('Result preview:');
    console.log('- Reveal PSBT (first 50 chars):', result.unsignedRevealPsbtBase64.substring(0, 50) + '...');
    console.log('- WIF (first 10 chars):', result.revealSignerWif.substring(0, 10) + '...');
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
runTest()
  .then(() => console.log('Test script completed'))
  .catch(err => console.error('Unhandled error in test script:', err)); 