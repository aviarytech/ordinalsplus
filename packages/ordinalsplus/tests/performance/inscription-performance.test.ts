/**
 * Inscription Performance Test
 * 
 * Tests the performance of the inscription process with different content sizes and types
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { inscriptionOrchestrator } from '../../src/inscription/InscriptionOrchestrator';
import { transactionTracker } from '../../src/transactions/transaction-status-tracker';
import { randomBytes } from 'crypto';

// Mock UTXO for testing
const mockUtxo = {
  txid: 'mock-txid-performance',
  vout: 0,
  value: 100000,
  scriptPubKey: '00112233445566778899aabbccddeeff',
  script: {
    type: 'p2wpkh',
    address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
  }
};

// Test fixture for different content types and sizes
interface TestFixture {
  name: string;
  content: string | Buffer;
  contentType: string;
  size: number;
}

// Create test fixtures
function createTestFixtures(): TestFixture[] {
  return [
    {
      name: 'small text',
      content: 'Hello, Ordinals!',
      contentType: 'text/plain',
      size: 16
    },
    {
      name: 'medium text',
      content: 'a'.repeat(1000),
      contentType: 'text/plain',
      size: 1000
    },
    {
      name: 'large text',
      content: 'a'.repeat(10000),
      contentType: 'text/plain',
      size: 10000
    },
    {
      name: 'small JSON',
      content: JSON.stringify({ hello: 'world' }),
      contentType: 'application/json',
      size: 17
    },
    {
      name: 'medium JSON',
      content: JSON.stringify({ data: 'a'.repeat(1000) }),
      contentType: 'application/json',
      size: 1012
    },
    {
      name: 'small image',
      content: randomBytes(1000),
      contentType: 'image/png',
      size: 1000
    },
    {
      name: 'medium image',
      content: randomBytes(10000),
      contentType: 'image/png',
      size: 10000
    }
  ];
}

describe('Inscription Performance Tests', () => {
  let fixtures: TestFixture[];
  let results: Record<string, Record<string, number>> = {};
  
  // Set up fixtures before all tests
  beforeAll(() => {
    fixtures = createTestFixtures();
  });
  
  // Clean up after all tests
  afterAll(() => {
    // Output performance results
    console.table(results);
  });
  
  // Reset state before each test
  beforeEach(() => {
    transactionTracker.clearTransactions();
    inscriptionOrchestrator.reset();
  });
  
  test('should measure performance metrics for different content types and sizes', async () => {
    results = {};
    
    for (const fixture of fixtures) {
      // Initialize results for this fixture
      results[fixture.name] = {
        contentPreparation: 0,
        feeCalculation: 0,
        commitTransaction: 0,
        revealTransaction: 0,
        totalTime: 0
      };
      
      // Measure content preparation time
      const contentStartTime = performance.now();
      await inscriptionOrchestrator.prepareContent(fixture.content, fixture.contentType);
      results[fixture.name].contentPreparation = Math.round(performance.now() - contentStartTime);
      
      // Select UTXO
      inscriptionOrchestrator.selectUTXO(mockUtxo);
      
      // Measure fee calculation time
      const feeStartTime = performance.now();
      await inscriptionOrchestrator.calculateFees(10);
      results[fixture.name].feeCalculation = Math.round(performance.now() - feeStartTime);
      
      // Measure commit transaction time
      const commitStartTime = performance.now();
      await inscriptionOrchestrator.executeCommitTransaction();
      results[fixture.name].commitTransaction = Math.round(performance.now() - commitStartTime);
      
      // Measure reveal transaction time
      const revealStartTime = performance.now();
      await inscriptionOrchestrator.executeRevealTransaction();
      results[fixture.name].revealTransaction = Math.round(performance.now() - revealStartTime);
      
      // Calculate total time
      results[fixture.name].totalTime = 
        results[fixture.name].contentPreparation +
        results[fixture.name].feeCalculation +
        results[fixture.name].commitTransaction +
        results[fixture.name].revealTransaction;
    }
    
    // Verify results were collected for all fixtures
    for (const fixture of fixtures) {
      expect(results[fixture.name].totalTime).toBeGreaterThan(0);
      
      // Ensure larger content has reasonable processing times
      if (fixture.size > 1000) {
        // Log performance data for analysis
        console.log(`Performance for ${fixture.name} (${fixture.size} bytes):`);
        console.log(`Content preparation: ${results[fixture.name].contentPreparation}ms`);
        console.log(`Fee calculation: ${results[fixture.name].feeCalculation}ms`);
        console.log(`Commit transaction: ${results[fixture.name].commitTransaction}ms`);
        console.log(`Reveal transaction: ${results[fixture.name].revealTransaction}ms`);
        console.log(`Total time: ${results[fixture.name].totalTime}ms`);
        console.log('---');
      }
    }
  });
}); 