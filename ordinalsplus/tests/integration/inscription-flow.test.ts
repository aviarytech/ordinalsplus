/**
 * Inscription Flow Integration Test
 * 
 * Tests the complete inscription flow from content preparation to reveal transaction
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { inscriptionOrchestrator } from '../../src/inscription/InscriptionOrchestrator';
import { transactionTracker, TransactionStatus } from '../../src/transactions/transaction-status-tracker';
import { TransactionType } from '../../src/types/transaction-type';

// Mock UTXO for testing
const mockUtxo = {
  txid: 'mock-txid-12345',
  vout: 0,
  value: 10000,
  scriptPubKey: '00112233445566778899aabbccddeeff',
  script: {
    type: 'p2wpkh',
    address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx'
  }
};

describe('Inscription Flow Integration Tests', () => {
  // Clear state before each test
  beforeEach(() => {
    transactionTracker.clearTransactions();
    inscriptionOrchestrator.reset();
    
    // Add event listeners to capture events
    jest.spyOn(inscriptionOrchestrator, 'emit');
  });
  
  // Clean up after each test
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  test('complete inscription flow should execute successfully', async () => {
    // Step 1: Prepare content
    await inscriptionOrchestrator.prepareContent('Hello, Ordinals!', 'text/plain');
    expect(inscriptionOrchestrator.emit).toHaveBeenCalledWith('contentPrepared', expect.any(Object));
    
    // Step 2: Select UTXO
    inscriptionOrchestrator.selectUTXO(mockUtxo);
    expect(inscriptionOrchestrator.emit).toHaveBeenCalledWith('utxoSelected', mockUtxo);
    
    // Step 3: Calculate fees
    const fees = await inscriptionOrchestrator.calculateFees(10);
    expect(fees).toHaveProperty('commit');
    expect(fees).toHaveProperty('reveal');
    expect(fees).toHaveProperty('total');
    expect(inscriptionOrchestrator.emit).toHaveBeenCalledWith('feesCalculated', fees);
    
    // Step 4: Execute commit transaction
    const commitTxid = await inscriptionOrchestrator.executeCommitTransaction();
    expect(commitTxid).toBeTruthy();
    expect(typeof commitTxid).toBe('string');
    expect(inscriptionOrchestrator.emit).toHaveBeenCalledWith('commitTransactionSent', expect.any(Object));
    
    // Verify commit transaction is tracked
    const trackedCommitTx = transactionTracker.getAllTransactions().find(tx => tx.txid === commitTxid);
    expect(trackedCommitTx).toBeDefined();
    expect(trackedCommitTx?.type).toBe(TransactionType.COMMIT);
    expect(trackedCommitTx?.status).toBe(TransactionStatus.PENDING);
    
    // Step 5: Execute reveal transaction
    const revealTxid = await inscriptionOrchestrator.executeRevealTransaction();
    expect(revealTxid).toBeTruthy();
    expect(typeof revealTxid).toBe('string');
    expect(inscriptionOrchestrator.emit).toHaveBeenCalledWith('revealTransactionSent', expect.any(Object));
    
    // Verify reveal transaction is tracked
    const trackedRevealTx = transactionTracker.getAllTransactions().find(tx => tx.txid === revealTxid);
    expect(trackedRevealTx).toBeDefined();
    expect(trackedRevealTx?.type).toBe(TransactionType.REVEAL);
    expect(trackedRevealTx?.status).toBe(TransactionStatus.PENDING);
    
    // Verify final state
    const state = inscriptionOrchestrator.getState();
    expect(state.content).toBeDefined();
    expect(state.contentType).toBe('text/plain');
    expect(state.utxo).toEqual(mockUtxo);
    expect(state.commitTx).toHaveProperty('txid', commitTxid);
    expect(state.revealTx).toHaveProperty('txid', revealTxid);
  });
  
  test('should handle errors in the inscription flow', async () => {
    // Mock error in content preparation
    jest.spyOn(inscriptionOrchestrator, 'prepareContent').mockRejectedValueOnce(new Error('Content preparation failed'));
    
    // Attempt to prepare content should fail
    await expect(inscriptionOrchestrator.prepareContent('invalid content', 'invalid/type')).rejects.toThrow();
    
    // Attempt to calculate fees without prepared content should fail
    await expect(inscriptionOrchestrator.calculateFees(10)).rejects.toThrow('Content must be prepared');
    
    // Attempt to execute commit transaction without calculated fees should fail
    await expect(inscriptionOrchestrator.executeCommitTransaction()).rejects.toThrow('Fees must be calculated');
    
    // Attempt to execute reveal transaction without commit transaction should fail
    await expect(inscriptionOrchestrator.executeRevealTransaction()).rejects.toThrow('Commit transaction must be confirmed');
  });
}); 