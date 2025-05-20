import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  TransactionBroadcaster, 
  BitcoinNodeConfig,
  BroadcastOptions
} from '../src/transactions/transaction-broadcasting';
import { 
  TransactionStatusTracker,
  TransactionType
} from '../src/transactions/transaction-status-tracker';
import { ErrorCode, InscriptionError } from '../src/utils/error-handler';

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock setTimeout and clearTimeout
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
global.setTimeout = vi.fn().mockImplementation((callback, delay) => {
  return originalSetTimeout(callback, 0) as unknown as NodeJS.Timeout;
});
global.clearTimeout = vi.fn().mockImplementation((id) => {
  originalClearTimeout(id);
});

// Mock AbortController
class MockAbortController {
  signal = { aborted: false };
  abort() {
    this.signal.aborted = true;
  }
}
global.AbortController = MockAbortController as any;

describe('TransactionBroadcaster', () => {
  let broadcaster: TransactionBroadcaster;
  let statusTracker: TransactionStatusTracker;
  
  // Sample test data
  const testTxHex = '0200000001abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890000000000ffffffff0100e1f505000000001976a9141234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef88ac00000000';
  const testTxid = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  
  // Test nodes
  const testNodes: BitcoinNodeConfig[] = [
    {
      name: 'test-node-1',
      url: 'https://test-node-1/api/tx',
      priority: 1,
      enabled: true,
      networkType: 'testnet'
    },
    {
      name: 'test-node-2',
      url: 'https://test-node-2/api/tx',
      priority: 2,
      enabled: true,
      networkType: 'testnet'
    },
    {
      name: 'disabled-node',
      url: 'https://disabled-node/api/tx',
      priority: 3,
      enabled: false,
      networkType: 'testnet'
    }
  ];
  
  // Test options
  const testOptions: BroadcastOptions = {
    network: 'testnet',
    maxRetries: 2,
    initialBackoffMs: 10,
    maxBackoffMs: 100,
    timeout: 100
  };
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh instances for each test
    statusTracker = new TransactionStatusTracker();
    broadcaster = new TransactionBroadcaster(statusTracker, testNodes);
    
    // Spy on status tracker methods
    vi.spyOn(statusTracker, 'addTransaction');
    vi.spyOn(statusTracker, 'updateTransactionTxid');
    vi.spyOn(statusTracker, 'setTransactionError');
    vi.spyOn(statusTracker, 'setTransactionStatus');
    vi.spyOn(statusTracker, 'addTransactionProgressEvent');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should initialize with the provided nodes', () => {
    expect(broadcaster['nodes']).toHaveLength(testNodes.length);
    expect(broadcaster['nodes'][0].name).toBe(testNodes[0].name);
  });
  
  it('should add and update nodes', () => {
    const newNode = {
      name: 'new-node',
      url: 'https://new-node/api/tx',
      priority: 1,
      enabled: true,
      networkType: 'mainnet'
    };
    
    broadcaster.addNode(newNode);
    expect(broadcaster['nodes']).toContainEqual(newNode);
    
    // Update existing node
    const updatedNode = { ...newNode, enabled: false };
    broadcaster.addNode(updatedNode);
    
    // Node should be updated, not duplicated
    const nodes = broadcaster['nodes'];
    const matchingNodes = nodes.filter(n => n.name === 'new-node');
    expect(matchingNodes).toHaveLength(1);
    expect(matchingNodes[0].enabled).toBe(false);
  });
  
  it('should enable and disable nodes', () => {
    broadcaster.setNodeEnabled('test-node-1', false);
    expect(broadcaster['nodes'].find(n => n.name === 'test-node-1')?.enabled).toBe(false);
    
    broadcaster.setNodeEnabled('test-node-1', true);
    expect(broadcaster['nodes'].find(n => n.name === 'test-node-1')?.enabled).toBe(true);
  });
  
  it('should filter active nodes by network and priority', () => {
    const activeNodes = broadcaster['getActiveNodes']('testnet');
    
    // Should only include enabled nodes
    expect(activeNodes).toHaveLength(2);
    
    // Should be sorted by priority
    expect(activeNodes[0].name).toBe('test-node-1');
    expect(activeNodes[1].name).toBe('test-node-2');
  });
  
  it('should validate transaction hex', () => {
    // Valid hex
    expect(broadcaster['validateTransactionHex'](testTxHex)).toBe(true);
    
    // Invalid hex (contains non-hex characters)
    expect(broadcaster['validateTransactionHex']('not-hex-string')).toBe(false);
    
    // Too short
    expect(broadcaster['validateTransactionHex']('ab')).toBe(false);
  });
  
  it('should successfully broadcast a transaction', async () => {
    // Mock successful response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => testTxid
    });
    
    const result = await broadcaster.broadcastTransaction(
      testTxHex, 
      TransactionType.COMMIT, 
      testOptions
    );
    
    // Should return txid and transaction ID
    expect(result.txid).toBe(testTxid);
    expect(result.transactionId).toBeDefined();
    
    // Should add transaction to tracker
    expect(statusTracker.addTransaction).toHaveBeenCalled();
    
    // Should update txid
    expect(statusTracker.updateTransactionTxid).toHaveBeenCalledWith(
      expect.any(String),
      testTxid
    );
    
    // Should use the correct broadcast URL
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test-node-1/api/tx',
      expect.objectContaining({
        method: 'POST',
        body: testTxHex
      })
    );
  });
  
  it('should retry on failure', async () => {
    // First request fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server error'
    });
    
    // Second request succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => testTxid
    });
    
    const result = await broadcaster.broadcastTransaction(
      testTxHex, 
      TransactionType.COMMIT, 
      testOptions
    );
    
    // Should eventually succeed
    expect(result.txid).toBe(testTxid);
    
    // Should call fetch twice (first fails, second succeeds)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
  
  it('should throw for invalid transaction hex', async () => {
    await expect(broadcaster.broadcastTransaction(
      'invalid-hex', 
      TransactionType.COMMIT, 
      testOptions
    )).rejects.toThrow(InscriptionError);
    
    // Should not call fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });
  
  it('should try multiple nodes on failure', async () => {
    // First node fails
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server error'
    });
    
    // Second node succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => testTxid
    });
    
    const result = await broadcaster.broadcastTransaction(
      testTxHex, 
      TransactionType.COMMIT, 
      testOptions
    );
    
    // Should eventually succeed
    expect(result.txid).toBe(testTxid);
    
    // Should call fetch twice (first node fails, second node succeeds)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    
    // First call should be to first node
    expect(mockFetch.mock.calls[0][0]).toBe('https://test-node-1/api/tx');
    
    // Second call should be to second node
    expect(mockFetch.mock.calls[1][0]).toBe('https://test-node-2/api/tx');
  });
  
  it('should throw if all nodes and retries fail', async () => {
    // All requests fail
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Server error'
    });
    
    await expect(broadcaster.broadcastTransaction(
      testTxHex, 
      TransactionType.COMMIT, 
      testOptions
    )).rejects.toThrow(InscriptionError);
    
    // Should try each node for each retry (2 nodes * 3 attempts)
    expect(mockFetch).toHaveBeenCalledTimes(6);
    
    // Should set transaction status to FAILED
    expect(statusTracker.setTransactionStatus).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('FAILED')
    );
  });
  
  it('should throw if no active nodes are available', async () => {
    // Create broadcaster with no active nodes for testnet
    const nodesMainnetOnly = [
      {
        name: 'mainnet-node',
        url: 'https://mainnet-node/api/tx',
        priority: 1,
        enabled: true,
        networkType: 'mainnet'
      }
    ];
    
    broadcaster = new TransactionBroadcaster(statusTracker, nodesMainnetOnly);
    
    await expect(broadcaster.broadcastTransaction(
      testTxHex, 
      TransactionType.COMMIT, 
      { network: 'testnet' }
    )).rejects.toThrow(expect.objectContaining({ 
      code: ErrorCode.NO_ACTIVE_NODES
    }));
    
    // Should not call fetch
    expect(mockFetch).not.toHaveBeenCalled();
  });
  
  it('should handle timeouts', async () => {
    // Mock AbortController to simulate timeout
    const originalAbort = MockAbortController.prototype.abort;
    MockAbortController.prototype.abort = function() {
      originalAbort.call(this);
      mockFetch.mockRejectedValueOnce(new Error('AbortError'));
    };
    
    // Mock fetch to never resolve
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));
    
    // Second request succeeds
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => testTxid
    });
    
    const result = await broadcaster.broadcastTransaction(
      testTxHex, 
      TransactionType.COMMIT, 
      testOptions
    );
    
    // Should eventually succeed on second try
    expect(result.txid).toBe(testTxid);
    
    // Reset mock
    MockAbortController.prototype.abort = originalAbort;
  });
  
  it('should cancel a broadcast', async () => {
    // Set up a broadcast that will be canceled
    const broadcastPromise = broadcaster.broadcastTransaction(
      testTxHex, 
      TransactionType.COMMIT, 
      testOptions
    );
    
    // Get the transaction ID from activeRetries map
    const transactionId = Array.from(broadcaster['activeRetries'].keys())[0];
    expect(transactionId).toBeDefined();
    
    // Cancel the broadcast
    broadcaster.cancelBroadcast(transactionId!);
    
    // Should clear from active retries
    expect(broadcaster['activeRetries'].has(transactionId!)).toBe(false);
    
    // Should update status to FAILED
    expect(statusTracker.setTransactionStatus).toHaveBeenCalledWith(
      transactionId,
      expect.stringContaining('FAILED')
    );
    
    // Should add error
    expect(statusTracker.setTransactionError).toHaveBeenCalledWith(
      transactionId,
      expect.objectContaining({
        code: ErrorCode.TRANSACTION_BROADCAST_CANCELLED
      })
    );
    
    // Mock to resolve so we don't get unhandled promise rejection
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => testTxid
    });
    
    // Wait for promise to resolve or reject
    try {
      await broadcastPromise;
    } catch (error) {
      // Expected to throw
    }
  });
}); 