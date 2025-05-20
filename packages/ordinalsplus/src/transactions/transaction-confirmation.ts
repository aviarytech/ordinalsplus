import { EventEmitter } from 'events';
import { Network, getRpcClientPlaceholder } from '../utils';
import { TransactionStatusTracker, TransactionStatus, TransactionEvent, TransactionProgressEvent } from './transaction-status-tracker';
import { ErrorHandler, InscriptionError, ErrorCode } from '../utils/error-handler';
import { Psbt } from 'bitcoinjs-lib';

// Configuration for the confirmation service
export interface ConfirmationServiceConfig {
  network?: Network;
  pollingIntervalMs?: number; // How often to check for confirmations
  rpcEndpoints?: string[]; // Optional: direct RPC endpoints
  mempoolApiUrl?: string; // Optional: Mempool.space API or similar
  maxRetries?: number; // Max retries for API calls
  initialDelayMs?: number; // Initial delay before first check
}

// Represents the confirmation status of a transaction
export interface TransactionConfirmationStatus {
  txid: string;
  confirmed: boolean;
  blockHeight?: number;
  confirmations?: number;
  error?: string;
}

// Events emitted by the service
export enum ConfirmationEvent {
  CONFIRMED = 'confirmed', // Transaction has at least one confirmation
  FINALIZED = 'finalized', // Transaction has reached a target number of confirmations (e.g., 6)
  ERROR = 'error', // An error occurred during tracking
  STATUS_UPDATE = 'statusUpdate', // General status update
  REORG_DETECTED = 'reorgDetected', // A chain reorganization affecting the transaction was detected
  DROPPED = 'dropped', // Transaction was dropped from mempool or replaced
}

const DEFAULT_POLLING_INTERVAL_MS = 30 * 1000; // 30 seconds
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_INITIAL_DELAY_MS = 5 * 1000; // 5 seconds
const DEFAULT_FINALITY_CONFIRMATIONS = 6;

// Placeholder for RPC client - replace with actual implementation or import
function getRpcClient(network: Network, endpoints?: string[]): any {
    console.warn("Using placeholder getRpcClient. Implement actual RPC client logic.");
    // This should return a client instance that has methods like getRawTransaction, getBlockCount, etc.
    // For now, returning a mock that won't actually work for RPC calls.
    return {
        getRawTransaction: async (txid: string, verbose?: boolean) => { 
            throw new Error('RPC getRawTransaction not implemented in placeholder'); 
        },
        getBlockCount: async () => { 
            throw new Error('RPC getBlockCount not implemented in placeholder'); 
        },
    };
}

export class TransactionConfirmationService extends EventEmitter {
  private config: Required<ConfirmationServiceConfig>;
  private watchedTransactions: Map<string, { psbt?: Psbt, retries: number, lastChecked: number, notifiedFinalized: boolean }> = new Map();
  private errorHandler: ErrorHandler;
  private statusTracker: TransactionStatusTracker;
  private rpcClient: any; // Type depends on the RPC client library used

  constructor(config: ConfirmationServiceConfig = {}, errorHandler: ErrorHandler, statusTracker: TransactionStatusTracker) {
    super();
    this.config = {
      network: config.network || 'mainnet',
      pollingIntervalMs: config.pollingIntervalMs || DEFAULT_POLLING_INTERVAL_MS,
      rpcEndpoints: config.rpcEndpoints || [],
      mempoolApiUrl: config.mempoolApiUrl || this.getDefaultMempoolApiUrl(config.network || 'mainnet'),
      maxRetries: config.maxRetries || DEFAULT_MAX_RETRIES,
      initialDelayMs: config.initialDelayMs || DEFAULT_INITIAL_DELAY_MS,
    };
    this.errorHandler = errorHandler;
    this.statusTracker = statusTracker;
    this.rpcClient = getRpcClient(this.config.network, this.config.rpcEndpoints); // Using placeholder

    // Start polling at intervals
    // setInterval(this.checkAllTransactions.bind(this), this.config.pollingIntervalMs);
    // This interval should be managed more carefully (e.g. clear on dispose)
  }

  private getDefaultMempoolApiUrl(network: Network): string {
    switch (network) {
      case 'mainnet':
        return 'https://mempool.space/api';
      case 'testnet':
        return 'https://mempool.space/testnet/api';
      case 'regtest':
        return ''; // Regtest might not have a public mempool API, direct RPC preferred
      default:
        return '';
    }
  }

  /**
   * Starts watching a transaction for confirmation.
   * @param txid The transaction ID to watch.
   * @param psbt Optional: The PSBT object associated with the transaction for more detailed tracking.
   */
  public watchTransaction(txid: string, psbt?: Psbt): void {
    if (this.watchedTransactions.has(txid)) {
      this.errorHandler.handleError(
        new InscriptionError({
            message: `Transaction ${txid} is already being watched.`,
            code: ErrorCode.TRANSACTION_ALREADY_WATCHED
        })
      );
      return;
    }
    this.watchedTransactions.set(txid, { psbt, retries: 0, lastChecked: 0, notifiedFinalized: false });
    this.statusTracker.setTransactionStatus(txid, TransactionStatus.PENDING_CONFIRMATION);
    this.emit(ConfirmationEvent.STATUS_UPDATE, { txid, status: TransactionStatus.PENDING_CONFIRMATION, message: 'Awaiting first confirmation check.' });

    // Schedule an initial check with a delay
    setTimeout(() => this.checkTransactionStatus(txid), this.config.initialDelayMs);
  }

  /**
   * Stops watching a transaction.
   * @param txid The transaction ID to stop watching.
   */
  public unwatchTransaction(txid: string): void {
    if (this.watchedTransactions.has(txid)) {
      this.watchedTransactions.delete(txid);
      this.statusTracker.setTransactionStatus(txid, TransactionStatus.UNWATCHED);
      this.emit(ConfirmationEvent.STATUS_UPDATE, { txid, status: TransactionStatus.UNWATCHED, message: 'Transaction monitoring stopped.' });
    }
  }

  /**
   * Periodically checks the status of all watched transactions.
   * This is intended to be called by an interval timer.
   */
  private async checkAllTransactions(): Promise<void> {
    if (this.watchedTransactions.size === 0) {
      return; // No transactions to check
    }
    // console.log(`[${new Date().toISOString()}] Checking ${this.watchedTransactions.size} transactions for confirmation...`);
    for (const txid of this.watchedTransactions.keys()) {
      await this.checkTransactionStatus(txid);
    }
  }

  /**
   * Checks the confirmation status of a single transaction.
   * @param txid The transaction ID.
   */
  private async checkTransactionStatus(txid: string): Promise<void> {
    const txData = this.watchedTransactions.get(txid);
    if (!txData) return;

    txData.lastChecked = Date.now();

    try {
      let status: TransactionConfirmationStatus | null = null;

      if (this.config.mempoolApiUrl) {
        status = await this.checkWithMempoolApi(txid);
      } else if (this.rpcClient) {
        // Fallback to RPC if Mempool API is not configured or fails
        status = await this.checkWithRpc(txid);
      } else {
        this.errorHandler.handleError(new InscriptionError({
          message: `No mempool API URL or RPC client configured for network ${this.config.network}. Cannot check tx ${txid}.`,
          code: ErrorCode.CONFIGURATION_ERROR
        }));
        this.emitError(txid, `Configuration error: No way to check transaction status.`);
        this.unwatchTransaction(txid); // Stop watching if unconfigurable
        return;
      }

      if (!status) { // Should not happen if API/RPC calls are successful
        this.emitError(txid, 'Failed to retrieve transaction status due to an unknown issue.');
        return;
      }

      const progressEvent: TransactionProgressEvent = {
          transactionId: txid,
          message: `Attempting confirmation check. Source: ${this.config.mempoolApiUrl ? 'mempool_api' : 'rpc'}`,
          timestamp: new Date(),
          data: { source: this.config.mempoolApiUrl ? 'mempool_api' : 'rpc' }
      };
      this.statusTracker.addTransactionProgressEvent(progressEvent);

      if (status.error) {
        this.handleApiError(txid, status.error, txData);
        return;
      }

      if (status.confirmed) {
        this.handleConfirmedTransaction(txid, status, txData);
      } else {
        this.statusTracker.setTransactionStatus(txid, TransactionStatus.MEMPOOL);
        this.emit(ConfirmationEvent.STATUS_UPDATE, { txid, status: TransactionStatus.MEMPOOL, message: `In mempool, 0 confirmations.` });
        // Keep polling if not confirmed but no error
        setTimeout(() => this.checkTransactionStatus(txid), this.config.pollingIntervalMs);
      }
    } catch (error: any) {
      this.errorHandler.handleError(
        new InscriptionError({
            message: `Error checking status for tx ${txid}: ${error.message}`,
            code: ErrorCode.TRANSACTION_CONFIRMATION_ERROR,
            details: error
        })
      );
      this.handleApiError(txid, error.message, txData);
    }
  }

  private handleConfirmedTransaction(txid: string, status: TransactionConfirmationStatus, txData: { psbt?: Psbt, retries: number, lastChecked: number, notifiedFinalized: boolean }) {
    const confirmations = status.confirmations || 0;
    this.statusTracker.setTransactionStatus(txid, TransactionStatus.CONFIRMED);
    this.emit(ConfirmationEvent.CONFIRMED, status);
    this.emit(ConfirmationEvent.STATUS_UPDATE, { txid, status: TransactionStatus.CONFIRMED, message: `Confirmed in block ${status.blockHeight} with ${confirmations} confirmations.`});
    txData.retries = 0; // Reset retries on successful confirmation

    if (confirmations >= DEFAULT_FINALITY_CONFIRMATIONS && !txData.notifiedFinalized) {
      this.statusTracker.setTransactionStatus(txid, TransactionStatus.FINALIZED);
      this.emit(ConfirmationEvent.FINALIZED, status);
      this.emit(ConfirmationEvent.STATUS_UPDATE, { txid, status: TransactionStatus.FINALIZED, message: `Finalized with ${confirmations} confirmations.`});
      txData.notifiedFinalized = true;
      this.unwatchTransaction(txid); // Stop watching after finality
    } else if (confirmations < DEFAULT_FINALITY_CONFIRMATIONS) {
      // Continue polling for finality
      setTimeout(() => this.checkTransactionStatus(txid), this.config.pollingIntervalMs);
    }
  }

  private handleApiError(txid: string, errorMessage: string, txData: { psbt?: Psbt, retries: number, lastChecked: number, notifiedFinalized: boolean }) {
    txData.retries++;
    const failureEvent: TransactionProgressEvent = {
        transactionId: txid,
        message: `Confirmation check failed. Error: ${errorMessage}, Retries: ${txData.retries}`,
        timestamp: new Date(),
        data: { error: errorMessage, retries: txData.retries }
    };
    this.statusTracker.addTransactionProgressEvent(failureEvent);

    if (errorMessage.toLowerCase().includes('transaction not found') || errorMessage.toLowerCase().includes('invalid txid')) {
        if (txData.retries >= this.config.maxRetries) {
            this.statusTracker.setTransactionStatus(txid, TransactionStatus.DROPPED_OR_REPLACED);
            this.emit(ConfirmationEvent.DROPPED, { txid, reason: 'Not found after retries' });
            this.emitError(txid, 'Transaction not found after multiple retries.');
            this.unwatchTransaction(txid);
        } else {
            // Still retry if not found, it might just be propagation delay
            this.statusTracker.setTransactionStatus(txid, TransactionStatus.PENDING_CONFIRMATION);
            setTimeout(() => this.checkTransactionStatus(txid), this.config.pollingIntervalMs * (txData.retries + 1)); // Exponential backoff for not found
        }
    } else if (txData.retries >= this.config.maxRetries) {
      this.statusTracker.setTransactionStatus(txid, TransactionStatus.ERROR);
      this.emitError(txid, `Failed to confirm after ${this.config.maxRetries} retries: ${errorMessage}`);
      this.unwatchTransaction(txid);
    } else {
      this.statusTracker.setTransactionStatus(txid, TransactionStatus.PENDING_CONFIRMATION);
      // General retry with normal interval
      setTimeout(() => this.checkTransactionStatus(txid), this.config.pollingIntervalMs);
    }
  }

  private emitError(txid: string, message: string, error?: any) {
    this.emit(ConfirmationEvent.ERROR, { txid, message, error });
    this.statusTracker.setTransactionStatus(txid, TransactionStatus.ERROR);
  }

  // --- Methods for fetching transaction status ---

  private async checkWithMempoolApi(txid: string): Promise<TransactionConfirmationStatus | null> {
    const url = `${this.config.mempoolApiUrl}/tx/${txid}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          return { txid, confirmed: false, error: 'Transaction not found' };
        }
        const errorText = await response.text();
        throw new InscriptionError({message: `Mempool API request failed: ${response.status} ${errorText}`, code: ErrorCode.EXTERNAL_API_ERROR});
      }
      const data = await response.json();
      return {
        txid,
        confirmed: data.status.confirmed,
        blockHeight: data.status.block_height,
        confirmations: data.status.confirmed ? (await this.getCurrentBlockHeight() - data.status.block_height + 1) : 0, // Mempool API itself does not give 'confirmations' field directly
      };
    } catch (error: any) {
      this.errorHandler.handleError(new InscriptionError({
        message: `Error fetching from Mempool API for tx ${txid}: ${error.message}`,
        code: ErrorCode.EXTERNAL_API_ERROR,
        details: error
    }));
      return { txid, confirmed: false, error: error.message };
    }
  }

  private async checkWithRpc(txid: string): Promise<TransactionConfirmationStatus | null> {
    try {
      // Example using a generic RPC client structure; adapt to your actual RPC client
      const txInfo = await this.rpcClient.getRawTransaction(txid, true); // true for verbose output
      if (!txInfo) {
        return { txid, confirmed: false, error: 'Transaction not found via RPC' };
      }
      return {
        txid,
        confirmed: !!txInfo.confirmations && txInfo.confirmations > 0,
        blockHeight: txInfo.blockheight, // Or derive from blockhash
        confirmations: txInfo.confirmations || 0,
      };
    } catch (error: any) {
       this.errorHandler.handleError(new InscriptionError({
        message: `Error fetching from RPC for tx ${txid}: ${error.message}`,
        code: ErrorCode.RPC_ERROR,
        details: error
    }));
       return { txid, confirmed: false, error: error.message };
    }
  }

  private async getCurrentBlockHeight(): Promise<number> {
    // Helper to get current block height, prefer Mempool API if available for less load on own node
    if (this.config.mempoolApiUrl) {
      try {
        const response = await fetch(`${this.config.mempoolApiUrl}/blocks/tip/height`);
        if (!response.ok) throw new Error('Failed to fetch tip height from Mempool API');
        const height = await response.text();
        return parseInt(height, 10);
      } catch (error: any) {
        this.errorHandler.handleError(new InscriptionError({
            message: `Failed to get current block height from Mempool API: ${error.message}`,
            code: ErrorCode.EXTERNAL_API_ERROR,
            details: error
        }));
        // Fallback to RPC if Mempool API fails for height
      }
    }
    
    if (this.rpcClient) {
      try {
        return await this.rpcClient.getBlockCount();
      } catch (error: any) {
         this.errorHandler.handleError(new InscriptionError({
            message: `Failed to get current block height from RPC: ${error.message}`,
            code: ErrorCode.RPC_ERROR,
            details: error
        }));
         throw error; // Rethrow if RPC also fails, as this is critical
      }
    }
    throw new InscriptionError({
        message: 'Cannot get current block height: No Mempool API URL and no RPC client configured.',
        code: ErrorCode.CONFIGURATION_ERROR
    });
  }

  /**
   * Initiates a check for all currently watched transactions.
   * Useful for manual refresh or on startup.
   */
  public forceCheckAll(): void {
    this.checkAllTransactions();
  }

  /**
   * Clean up resources, like clearing intervals.
   */
  public dispose(): void {
    // Clear any active intervals or timeouts
    // For example, if you assigned the interval to a property:
    // if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
    this.watchedTransactions.clear();
    this.removeAllListeners();
    // console.log('TransactionConfirmationService disposed.');
  }
}

// Example usage (illustrative, not part of the class itself):
/*
async function example() {
  const errorHandler = new ErrorHandler();
  const statusTracker = new TransactionStatusTracker(errorHandler);
  const confirmationService = new TransactionConfirmationService(
    { network: BitcoinNetwork.TESTNET }, // or BitcoinNetwork.MAINNET
    errorHandler,
    statusTracker
  );

  confirmationService.on(ConfirmationEvent.CONFIRMED, (status) => {
    console.log('Transaction Confirmed:', status);
  });

  confirmationService.on(ConfirmationEvent.FINALIZED, (status) => {
    console.log('Transaction Finalized:', status);
    // confirmationService.unwatchTransaction(status.txid); // Or let the service auto-unwatch
  });

  confirmationService.on(ConfirmationEvent.ERROR, (error) => {
    console.error('Confirmation Error:', error);
  });

  confirmationService.on(ConfirmationEvent.STATUS_UPDATE, (update) => {
    console.log('Status Update:', update.txid, update.status, update.message);
  });

  // Start watching a transaction (replace with a real testnet/mainnet txid)
  const exampleTxid = 'YOUR_TEST_TRANSACTION_ID_HERE';
  confirmationService.watchTransaction(exampleTxid);

  // To manually trigger a check for all watched transactions:
  // confirmationService.forceCheckAll();

  // To stop watching:
  // confirmationService.unwatchTransaction(exampleTxid);

  // Remember to dispose of the service when no longer needed
  // setTimeout(() => confirmationService.dispose(), 5 * 60 * 1000); // Dispose after 5 minutes for example
}

// example();
*/ 