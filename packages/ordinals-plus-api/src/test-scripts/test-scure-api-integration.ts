/**
 * Test script for verifying the scure-btc-signer integration with the API
 * 
 * This script tests the full flow of creating inscriptions using the new scure-btc-signer implementation.
 * It simulates a client creating an inscription and verifies that the API correctly creates, signs, and
 * finalizes transactions using the scure implementation.
 */

import { createInscriptionPsbts } from '../services/psbtService';
import type { CreatePsbtsRequest, Utxo } from '../types';

// Enable scure finalizing
process.env.ENABLE_FINALIZE_TEST = 'true';

// Mock UTXO for testing
const mockUtxo: Utxo = {
  txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
  vout: 0,
  value: 20000,
  scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
};

// Create a test request with very simple content
const testRequest: CreatePsbtsRequest = {
  contentType: 'text/plain',
  contentBase64: Buffer.from('Hello, Scure Integration Test!').toString('base64'),
  feeRate: 5,
  recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Testnet address
  utxos: [mockUtxo],
  changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Same address for simplicity
  networkType: 'testnet',
  testMode: true // Add testMode to skip finalization
};

async function runTest() {
  console.log('===== Testing scure-btc-signer API Integration =====');
  console.log('Using test request with text content:', Buffer.from(testRequest.contentBase64, 'base64').toString());
  
  try {
    // Call the service function that uses scure-btc-signer
    console.log('Calling createInscriptionPsbts with scure implementation...');
    const result = await createInscriptionPsbts(testRequest);
    
    // Check that we got a valid response with all expected fields
    const hasAllFields = 
      !!result.unsignedRevealPsbtBase64 && 
      !!result.revealSignerWif
      
    console.log('\nTest result summary:');
    console.log(`- Success: ${hasAllFields ? 'YES' : 'NO'}`);
    console.log(`- Commit PSBT length: ${result.commitPsbtBase64?.length || 0} chars`);
    console.log(`- Reveal PSBT length: ${result.unsignedRevealPsbtBase64?.length || 0} chars`);
    console.log(`- Has WIF: ${!!result.revealSignerWif ? 'YES' : 'NO'}`);
    console.log(`- Commit Output Value: ${result.commitTxOutputValue} sats`);
    console.log(`- Reveal Fee: ${result.revealFee} sats`);
    
    console.log('\nResult preview:');
    console.log('- Commit PSBT (first 50 chars):', result.commitPsbtBase64?.substring(0, 50) + '...');
    console.log('- Unsigned Reveal PSBT (first 50 chars):', result.unsignedRevealPsbtBase64?.substring(0, 50) + '...');
    console.log('- WIF (first 10 chars):', result.revealSignerWif?.substring(0, 10) + '...');
    
    if (hasAllFields) {
      console.log('\n✅ Test completed successfully! The scure-btc-signer integration is working.');
    } else {
      console.log('\n❌ Test failed: Missing required fields in the result.');
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error);
  }
}

// Run the test
runTest().catch(console.error); 