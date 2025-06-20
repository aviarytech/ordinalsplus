import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'events';
import { TransactionConfirmationService, ConfirmationEvent, ConfirmationServiceConfig, TransactionConfirmationStatus } from '../src/transactions/transaction-confirmation';
import { TransactionStatusTracker, TransactionStatus, TransactionEvent, TransactionProgressEvent } from '../src/transactions/transaction-status-tracker';
import { ErrorHandler, InscriptionError, ErrorCode } from '../src/utils/error-handler';
import { Network } from '../src/utils'; // Assuming Network type is exported from utils
import { Psbt } from 'bitcoinjs-lib';

// Mock dependencies
vi.mock('../src/transactions/transaction-status-tracker');
vi.mock('../src/utils/error-handler');

// Mock global fetch
global.fetch = vi.fn();

// Mock setTimeout and clearTimeout
vi.useFakeTimers();

const mockErrorHandler = {
  handleError: vi.fn(),
  createError: vi.fn((code: ErrorCode, details?: unknown, customMessage?: string) => new InscriptionError({ code, message: customMessage || 'Mock Error', details })),
} as unknown as ErrorHandler;

const mockStatusTracker = {
  setTransactionStatus: vi.fn(),
  addTransactionProgressEvent: vi.fn(),
  // Add other methods if they are called by the service during tests
} as unknown as TransactionStatusTracker;


describe('TransactionConfirmationService', () => {
  let confirmationService: TransactionConfirmationService;
  const testTxid = 'testtxid123';
  const mockPsbt = {} as Psbt; // Simple mock, expand if needed

  beforeEach(() => {
    vi.clearAllMocks(); // Clears mock call history, but not implementations
    
    // Reset mocks to their default behavior or new instances if needed
    global.fetch = vi.fn() as Mock;
    // Re-assign mocked instances if their state needs to be fresh for each test
    // This is important if the constructor or methods modify these mocks internally.
    confirmationService = new TransactionConfirmationService(
      { network: 'testnet', mempoolApiUrl: 'https://mempool.space/testnet/api' }, 
      mockErrorHandler, 
      mockStatusTracker
    );
  });

  afterEach(() => {
    confirmationService.dispose();
    vi.clearAllTimers();
  });

  it('should initialize with default config if none provided', () => {
    const service = new TransactionConfirmationService({}, mockErrorHandler, mockStatusTracker);
    // @ts-expect-error Accessing private config for test
    expect(service.config.network).toBe('mainnet');
    // @ts-expect-error Accessing private config for test
    expect(service.config.mempoolApiUrl).toBe('https://mempool.space/api'); // Default for mainnet
    // @ts-expect-error Accessing private config for test
    expect(service.config.pollingIntervalMs).toBe(30000);
  });

  it('should watch a new transaction and schedule initial check', () => {
    confirmationService.watchTransaction(testTxid, mockPsbt);
    // @ts-expect-error Accessing private watchedTransactions for test
    expect(confirmationService.watchedTransactions.has(testTxid)).toBe(true);
    expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.PENDING_CONFIRMATION);
    
    // Check if setTimeout was called for the initial check
    expect(setTimeout).toHaveBeenCalledTimes(1);
    // @ts-expect-error Accessing private config for test
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), confirmationService.config.initialDelayMs);
  });

  it('should not watch a transaction if already watched, and handle error', () => {
    confirmationService.watchTransaction(testTxid);
    vi.clearAllMocks(); // Clear mocks after first watch
    confirmationService.watchTransaction(testTxid);
    
    // @ts-expect-error Accessing private watchedTransactions for test
    expect(confirmationService.watchedTransactions.size).toBe(1); // Should still be 1
    expect(mockErrorHandler.handleError).toHaveBeenCalledWith(expect.any(InscriptionError));
    const handledError = (mockErrorHandler.handleError as Mock).mock.calls[0][0] as InscriptionError;
    expect(handledError.code).toBe(ErrorCode.TRANSACTION_ALREADY_WATCHED);
    expect(setTimeout).not.toHaveBeenCalled(); // No new timeout should be set
  });

  it('should unwatch a transaction', () => {
    confirmationService.watchTransaction(testTxid);
    confirmationService.unwatchTransaction(testTxid);
    // @ts-expect-error Accessing private watchedTransactions for test
    expect(confirmationService.watchedTransactions.has(testTxid)).toBe(false);
    expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.UNWATCHED);
  });

  describe('checkTransactionStatus via Mempool API', () => {
    it('should handle a confirmed transaction and emit CONFIRMED and FINALIZED events if confirmations >= 6', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: { confirmed: true, block_height: 100 },
        }),
      });
      // Mock getCurrentBlockHeight, assuming it uses fetch as well or direct RPC mock
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        text: async () => '105', // Current block height making it 6 confirmations
      });

      const confirmedHandler = vi.fn();
      const finalizedHandler = vi.fn();
      confirmationService.on(ConfirmationEvent.CONFIRMED, confirmedHandler);
      confirmationService.on(ConfirmationEvent.FINALIZED, finalizedHandler);

      confirmationService.watchTransaction(testTxid);
      vi.runOnlyPendingTimers(); // Run initial setTimeout
      await Promise.resolve(); // Allow promises to resolve

      expect(fetch).toHaveBeenCalledWith(`https://mempool.space/testnet/api/tx/${testTxid}`);
      expect(fetch).toHaveBeenCalledWith('https://mempool.space/testnet/api/blocks/tip/height');
      expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.CONFIRMED);
      expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.FINALIZED);
      expect(confirmedHandler).toHaveBeenCalledWith(expect.objectContaining({ txid: testTxid, confirmed: true, confirmations: 6, blockHeight: 100 }));
      expect(finalizedHandler).toHaveBeenCalledWith(expect.objectContaining({ txid: testTxid, confirmed: true, confirmations: 6, blockHeight: 100 }));
      // @ts-expect-error Accessing private watchedTransactions for test
      expect(confirmationService.watchedTransactions.has(testTxid)).toBe(false); // Should be unwatched after finalization
    });

    it('should handle a transaction in mempool (not confirmed) and reschedule check', async () => {
      (fetch as Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: { confirmed: false } }),
      });

      confirmationService.watchTransaction(testTxid);
      vi.runOnlyPendingTimers(); // Run initial setTimeout
      await Promise.resolve(); // Allow promises to resolve
      
      expect(fetch).toHaveBeenCalledWith(`https://mempool.space/testnet/api/tx/${testTxid}`);
      expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.MEMPOOL);
      expect(setTimeout).toHaveBeenCalledTimes(2); // Initial + reschedule
       // @ts-expect-error Accessing private config for test
      expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), confirmationService.config.pollingIntervalMs);
    });

    it('should handle API error (e.g., 404 Not Found) and retry, then mark as DROPPED', async () => {
      const maxRetries = 1; // Override for this test
      confirmationService = new TransactionConfirmationService(
        { network: 'testnet', mempoolApiUrl: 'https://mempool.space/testnet/api', maxRetries }, 
        mockErrorHandler, 
        mockStatusTracker
      );
      
      (fetch as Mock).mockResolvedValue({ ok: false, status: 404 }); // Mock fetch to return 404

      const droppedHandler = vi.fn();
      confirmationService.on(ConfirmationEvent.DROPPED, droppedHandler);

      confirmationService.watchTransaction(testTxid);

      // Initial check
      vi.runOnlyPendingTimers(); 
      await Promise.resolve(); 
      expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.PENDING_CONFIRMATION);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Retry check (after pollingIntervalMs * (retries+1) which is pollingIntervalMs * 1 here)
      vi.runOnlyPendingTimers();
      await Promise.resolve();
      expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.DROPPED_OR_REPLACED);
      expect(droppedHandler).toHaveBeenCalledWith({ txid: testTxid, reason: 'Not found after retries' });
      expect(fetch).toHaveBeenCalledTimes(2); // Initial call + 1 retry
       // @ts-expect-error Accessing private watchedTransactions for test
      expect(confirmationService.watchedTransactions.has(testTxid)).toBe(false); // Should be unwatched
    });
    
    it('should handle general API error, retry, then emit ERROR and unwatch', async () => {
      const maxRetries = 1; 
      confirmationService = new TransactionConfirmationService(
        { network: 'testnet', mempoolApiUrl: 'https://mempool.space/testnet/api', maxRetries }, 
        mockErrorHandler, 
        mockStatusTracker
      );
      
      (fetch as Mock).mockResolvedValue({ ok: false, status: 500, text: async () => 'Server Error' });

      const errorHandlerEmit = vi.fn();
      confirmationService.on(ConfirmationEvent.ERROR, errorHandlerEmit);

      confirmationService.watchTransaction(testTxid);

      // Initial check
      vi.runOnlyPendingTimers(); 
      await Promise.resolve(); 
      expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.PENDING_CONFIRMATION);
      expect(fetch).toHaveBeenCalledTimes(1);

      // Retry check (normal polling interval for general errors)
      vi.runOnlyPendingTimers(); 
      await Promise.resolve(); 
      expect(mockStatusTracker.setTransactionStatus).toHaveBeenCalledWith(testTxid, TransactionStatus.ERROR);
      expect(errorHandlerEmit).toHaveBeenCalledWith(expect.objectContaining({ txid: testTxid, message: 'Failed to confirm after 1 retries: Server Error' }));
      expect(fetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
      // @ts-expect-error Accessing private watchedTransactions for test
      expect(confirmationService.watchedTransactions.has(testTxid)).toBe(false);
    });

  });

  test('dispose should clear watchers and listeners correctly', () => {
    confirmationService.watchTransaction(testTxid, mockPsbt);
    const handler = vi.fn();
    confirmationService.on(ConfirmationEvent.CONFIRMED, handler);
    confirmationService.dispose();
    // @ts-expect-error access private watchedTransactions for test
    expect(confirmationService.watchedTransactions.size).toBe(0);
    expect(confirmationService.listenerCount(ConfirmationEvent.CONFIRMED)).toBe(0);
  });
});
