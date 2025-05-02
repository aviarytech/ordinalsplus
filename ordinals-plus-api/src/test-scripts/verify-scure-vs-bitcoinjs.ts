/**
 * Verification script to compare the API behavior using both implementations
 * 
 * This script tests the API's behavior when using the scure-btc-signer
 * implementation vs the bitcoinjs-lib implementation.
 */

import { createInscriptionPsbts } from '../services/psbtService';
import type { CreatePsbtsRequest, Utxo } from '../types';

// Define the response type if not exported from types
interface CreatePsbtsResponse {
  commitPsbtBase64?: string;
  unsignedRevealPsbtBase64: string;
  revealSignerWif: string;
  revealFee: number;
  commitTxOutputValue: number;
  [key: string]: any; // Allow any additional properties
}

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
  contentBase64: Buffer.from('Hello, Integration Test!').toString('base64'),
  feeRate: 5,
  recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Testnet address
  utxos: [mockUtxo],
  changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx', // Same address for simplicity
  networkType: 'testnet',
  testMode: true // Add testMode to skip finalization
};

// Track results from both implementations
let bitcoinjsResults: CreatePsbtsResponse | null = null;
let scureResults: CreatePsbtsResponse | null = null;

async function runTest() {
  console.log('===== Comparing BitcoinJS vs Scure API Integration =====');
  console.log('Test content:', Buffer.from(testRequest.contentBase64, 'base64').toString());
  
  // First test with bitcoinjs-lib (default implementation)
  try {
    console.log('\n1. Testing with original bitcoinjs-lib implementation...');
    process.env.USE_SCURE_IMPLEMENTATION = 'false';
    
    const btcjsRequest = { ...testRequest, seed: 'bitcoinjs-test' };
    bitcoinjsResults = await createInscriptionPsbts(btcjsRequest);
    
    console.log('✅ BitcoinJS implementation test succeeded');
  } catch (error) {
    console.error('❌ BitcoinJS implementation test failed with error:', error);
  }
  
  // Then test with scure-btc-signer implementation
  try {
    console.log('\n2. Testing with new scure-btc-signer implementation...');
    process.env.USE_SCURE_IMPLEMENTATION = 'true';
    
    const scureRequest = { ...testRequest, seed: 'scure-test' };
    scureResults = await createInscriptionPsbts(scureRequest);
    
    console.log('✅ Scure implementation test succeeded');
  } catch (error) {
    console.error('❌ Scure implementation test failed with error:', error);
  }
  
  // Now compare the results
  console.log('\n===== COMPARISON RESULTS =====');
  
  if (!bitcoinjsResults && !scureResults) {
    console.log('❌ Both implementations failed - cannot compare');
    return;
  }
  
  if (!bitcoinjsResults) {
    console.log('❌ BitcoinJS implementation failed - cannot perform full comparison');
    return;
  }
  
  if (!scureResults) {
    console.log('❌ Scure implementation failed - cannot perform full comparison');
    return;
  }
  
  // Compare outputs of both implementations
  const comparison = {
    success: true,
    fields: {
      revealFee: compareValues(bitcoinjsResults.revealFee, scureResults.revealFee),
      commitTxOutputValue: compareValues(bitcoinjsResults.commitTxOutputValue, scureResults.commitTxOutputValue),
      hasCommitPsbt: compareValues(!!bitcoinjsResults.commitPsbtBase64, !!scureResults.commitPsbtBase64),
      hasUnsignedRevealPsbt: compareValues(!!bitcoinjsResults.unsignedRevealPsbtBase64, !!scureResults.unsignedRevealPsbtBase64),
      hasRevealSignerWif: compareValues(!!bitcoinjsResults.revealSignerWif, !!scureResults.revealSignerWif),
    }
  };
  
  // Show detailed comparison
  console.log('Field-by-field comparison:');
  Object.entries(comparison.fields).forEach(([field, result]) => {
    console.log(`- ${field}: ${result.match ? '✅ Match' : '❌ Different'} ${result.details}`);
    if (!result.match) comparison.success = false;
  });
  
  // More detailed comparison for PSBT structures
  if (bitcoinjsResults.commitPsbtBase64 && scureResults.commitPsbtBase64) {
    const psbtsComparison = comparePsbts(
      bitcoinjsResults.commitPsbtBase64, 
      scureResults.commitPsbtBase64,
      'Commit PSBT'
    );
    
    console.log(`- Commit PSBT structure: ${psbtsComparison.match ? '✅ Similar' : '❌ Different'}`);
    console.log(`  ${psbtsComparison.details}`);
    if (!psbtsComparison.match) comparison.success = false;
  }
  
  if (bitcoinjsResults.unsignedRevealPsbtBase64 && scureResults.unsignedRevealPsbtBase64) {
    const psbtsComparison = comparePsbts(
      bitcoinjsResults.unsignedRevealPsbtBase64, 
      scureResults.unsignedRevealPsbtBase64,
      'Unsigned Reveal PSBT'
    );
    
    console.log(`- Unsigned Reveal PSBT structure: ${psbtsComparison.match ? '✅ Similar' : '❌ Different'}`);
    console.log(`  ${psbtsComparison.details}`);
    if (!psbtsComparison.match) comparison.success = false;
  }
  
  // Final result
  if (comparison.success) {
    console.log('\n✅ VERIFICATION SUCCESSFUL: Both implementations produce compatible results');
  } else {
    console.log('\n⚠️ VERIFICATION WARNING: Implementations produce different results');
    console.log('This may be acceptable if the differences are not significant, but should be reviewed');
  }
  
  // Extra details for manual inspection
  console.log('\nDetailed outputs for manual review:');
  
  console.log('\nBitcoinJS implementation values:');
  console.log(`- Commit Output Value: ${bitcoinjsResults.commitTxOutputValue} sats`);
  console.log(`- Reveal Fee: ${bitcoinjsResults.revealFee} sats`);
  console.log(`- Commit PSBT (first 50 chars): ${bitcoinjsResults.commitPsbtBase64?.substring(0, 50)}...`);
  console.log(`- Unsigned Reveal PSBT (first 50 chars): ${bitcoinjsResults.unsignedRevealPsbtBase64?.substring(0, 50)}...`);
  
  console.log('\nScure implementation values:');
  console.log(`- Commit Output Value: ${scureResults.commitTxOutputValue} sats`);
  console.log(`- Reveal Fee: ${scureResults.revealFee} sats`);
  console.log(`- Commit PSBT (first 50 chars): ${scureResults.commitPsbtBase64?.substring(0, 50)}...`);
  console.log(`- Unsigned Reveal PSBT (first 50 chars): ${scureResults.unsignedRevealPsbtBase64?.substring(0, 50)}...`);
}

// Helper function to compare values
function compareValues(a: any, b: any): { match: boolean, details: string } {
  if (a === b) {
    return { match: true, details: `(${a})` };
  }
  
  // For numbers, check if they're within 10% of each other (for fees, etc.)
  if (typeof a === 'number' && typeof b === 'number') {
    const percentDiff = Math.abs((a - b) / ((a + b) / 2)) * 100;
    if (percentDiff < 10) {
      return { 
        match: true, 
        details: `(Values within 10%: ${a} vs ${b}, diff: ${percentDiff.toFixed(2)}%)` 
      };
    }
    return { 
      match: false, 
      details: `(${a} vs ${b}, diff: ${percentDiff.toFixed(2)}%)` 
    };
  }
  
  return { match: false, details: `(${a} vs ${b})` };
}

// Helper function to compare PSBT structures
function comparePsbts(psbt1: string, psbt2: string, label: string): { match: boolean, details: string } {
  // Basic length comparison
  const lengthDiff = Math.abs(psbt1.length - psbt2.length);
  const lengthPercent = (lengthDiff / Math.max(psbt1.length, psbt2.length)) * 100;
  
  // Check if they start with the same prefix
  const prefixLength = 20;
  const samePrefix = psbt1.substring(0, prefixLength) === psbt2.substring(0, prefixLength);
  
  // For PSBTs, we consider them similar if:
  // 1. They start with the same prefix (first 20 chars)
  // 2. Their lengths are within 20% of each other
  const isSimilar = samePrefix && lengthPercent < 20;
  
  return {
    match: isSimilar,
    details: `Length diff: ${lengthDiff} chars (${lengthPercent.toFixed(2)}%), Same prefix: ${samePrefix ? 'Yes' : 'No'}`
  };
}

// Run the test
runTest().catch(console.error); 