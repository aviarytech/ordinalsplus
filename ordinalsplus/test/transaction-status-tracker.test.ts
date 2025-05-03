import { describe, test, expect } from 'bun:test';
import { 
  TransactionStatus, 
  createTransactionStatusTracker, 
  TransactionStatusTracker,
  Transaction,
  TransactionType
} from '../src/transactions/transaction-status-tracker';

/**
 * Test suite for transaction status tracking functionality.
 * This is related to Task 7: Develop Transaction Status Tracking
 */
describe('Transaction Status Tracking', () => {
  // Test data
  const mockCommitTx: Transaction = {
    id: 'commitTx123',
    txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    type: TransactionType.COMMIT,
    status: TransactionStatus.PENDING,
    createdAt: new Date(),
    lastUpdatedAt: new Date()
  };
  
  const mockRevealTx: Transaction = {
    id: 'revealTx456',
    txid: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    type: TransactionType.REVEAL,
    status: TransactionStatus.PENDING,
    createdAt: new Date(),
    lastUpdatedAt: new Date()
  };

  test('should create a transaction status tracker with initial state', () => {
    const tracker = createTransactionStatusTracker();
    
    expect(tracker).toBeDefined();
    expect(tracker.getTransactions()).toBeDefined();
    expect(tracker.getTransactions().length).toBe(0);
  });

  test('should add transactions to the tracker', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    expect(tracker.getTransactions().length).toBe(1);
    expect(tracker.getTransactions()[0].txid).toBe(mockCommitTx.txid);
    
    tracker.addTransaction(mockRevealTx);
    expect(tracker.getTransactions().length).toBe(2);
  });

  test('should update transaction status', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    const updatedStatus = TransactionStatus.CONFIRMED;
    
    tracker.updateTransactionStatus(mockCommitTx.id, updatedStatus);
    
    const updatedTx = tracker.getTransactionById(mockCommitTx.id);
    expect(updatedTx).toBeDefined();
    expect(updatedTx?.status).toBe(updatedStatus);
    expect(updatedTx?.lastUpdatedAt.getTime()).toBeGreaterThanOrEqual(mockCommitTx.lastUpdatedAt.getTime());
  });

  test('should get transaction by ID', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    tracker.addTransaction(mockRevealTx);
    
    const tx = tracker.getTransactionById(mockCommitTx.id);
    expect(tx).toBeDefined();
    expect(tx?.id).toBe(mockCommitTx.id);
    
    const nonExistentTx = tracker.getTransactionById('nonexistent');
    expect(nonExistentTx).toBeUndefined();
  });

  test('should filter transactions by type', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    tracker.addTransaction(mockRevealTx);
    
    const commitTxs = tracker.getTransactionsByType(TransactionType.COMMIT);
    expect(commitTxs.length).toBe(1);
    expect(commitTxs[0].id).toBe(mockCommitTx.id);
    
    const revealTxs = tracker.getTransactionsByType(TransactionType.REVEAL);
    expect(revealTxs.length).toBe(1);
    expect(revealTxs[0].id).toBe(mockRevealTx.id);
  });

  test('should filter transactions by status', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    tracker.addTransaction({...mockRevealTx, status: TransactionStatus.CONFIRMED});
    
    const pendingTxs = tracker.getTransactionsByStatus(TransactionStatus.PENDING);
    expect(pendingTxs.length).toBe(1);
    expect(pendingTxs[0].id).toBe(mockCommitTx.id);
    
    const confirmedTxs = tracker.getTransactionsByStatus(TransactionStatus.CONFIRMED);
    expect(confirmedTxs.length).toBe(1);
    expect(confirmedTxs[0].id).toBe(mockRevealTx.id);
  });

  test('should get transaction explorer URL based on network', () => {
    const tracker = createTransactionStatusTracker();
    
    // Test mainnet URL
    const mainnetUrl = tracker.getTransactionExplorerUrl(mockCommitTx.txid, 'mainnet');
    expect(mainnetUrl).toContain('blockchain.com/explorer/transactions/btc');
    expect(mainnetUrl).toContain(mockCommitTx.txid);
    
    // Test testnet URL
    const testnetUrl = tracker.getTransactionExplorerUrl(mockCommitTx.txid, 'testnet');
    expect(testnetUrl).toContain('blockchain.com/explorer/transactions/btc-testnet');
    expect(testnetUrl).toContain(mockCommitTx.txid);
  });

  test('should add transaction progress event', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    
    const progressEvent = {
      transactionId: mockCommitTx.id,
      message: 'Broadcasting transaction to network',
      timestamp: new Date()
    };
    
    tracker.addTransactionProgressEvent(progressEvent);
    
    const events = tracker.getTransactionProgressEvents(mockCommitTx.id);
    expect(events.length).toBe(1);
    expect(events[0].message).toBe(progressEvent.message);
  });

  test('should clear transactions', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    tracker.addTransaction(mockRevealTx);
    
    expect(tracker.getTransactions().length).toBe(2);
    
    tracker.clearTransactions();
    
    expect(tracker.getTransactions().length).toBe(0);
  });

  test('should handle transaction errors', () => {
    const tracker = createTransactionStatusTracker();
    
    tracker.addTransaction(mockCommitTx);
    
    const errorDetails = {
      message: 'Network error while broadcasting transaction',
      code: 'NETWORK_ERROR'
    };
    
    tracker.setTransactionError(mockCommitTx.id, errorDetails);
    
    const tx = tracker.getTransactionById(mockCommitTx.id);
    expect(tx).toBeDefined();
    expect(tx?.status).toBe(TransactionStatus.FAILED);
    expect(tx?.error).toBeDefined();
    expect(tx?.error?.message).toBe(errorDetails.message);
  });

  test('should create linked transactions (commit -> reveal)', () => {
    const tracker = createTransactionStatusTracker();
    
    // Add commit transaction
    tracker.addTransaction(mockCommitTx);
    
    // Add linked reveal transaction
    const linkedRevealTx = {...mockRevealTx, parentId: mockCommitTx.id};
    tracker.addTransaction(linkedRevealTx);
    
    // Get the reveal transaction
    const revealTx = tracker.getTransactionById(linkedRevealTx.id);
    expect(revealTx).toBeDefined();
    expect(revealTx?.parentId).toBe(mockCommitTx.id);
    
    // Get child transactions of the commit tx
    const children = tracker.getChildTransactions(mockCommitTx.id);
    expect(children.length).toBe(1);
    expect(children[0].id).toBe(linkedRevealTx.id);
  });
}); 