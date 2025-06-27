/**
 * Recovery Utilities
 * 
 * This module provides functions for recovering from errors and handling edge cases
 * in the ordinals inscription process.
 */

import { ErrorCode, InscriptionError, ErrorCategory } from './error-handler';
import { TransactionStatus, TransactionStatusTracker, TransactionType, TrackedTransaction } from '../transactions/transaction-status-tracker';

// Create singleton tracker instance or use existing one from module
const transactionTracker = new TransactionStatusTracker();

/**
 * Retry options for operations
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds before first retry */
  initialDelay: number;
  /** Multiplier for delay between retries */
  factor: number;
  /** Optional callback to execute before retry */
  onRetry?: (attempt: number, delay: number) => void;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  factor: 2 // exponential backoff
};

/**
 * Retry an operation with exponential backoff
 * 
 * @param operation The operation to retry
 * @param options Retry options
 * @returns Result of the operation
 * @throws The last error if all retries fail
 */
export async function retryOperation<T>(
  operation: () => Promise<T> | T,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOpts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < retryOpts.maxRetries) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;
      
      if (attempt >= retryOpts.maxRetries) {
        break;
      }
      
      const delay = retryOpts.initialDelay * Math.pow(retryOpts.factor, attempt - 1);
      
      if (retryOpts.onRetry) {
        retryOpts.onRetry(attempt, delay);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Resume a pending transaction
 * 
 * @param transactionId The ID of the transaction to resume
 * @returns True if the transaction was resumed successfully
 */
export async function resumeTransaction(transactionId: string): Promise<boolean> {
  const transaction = transactionTracker.getTransaction(transactionId);
  
  if (!transaction) {
    throw new Error(`Transaction ${transactionId} not found`);
  }
  
  if (transaction.status !== TransactionStatus.PENDING) {
    throw new Error(`Cannot resume transaction in ${transaction.status} state`);
  }
  
  // Implement transaction-specific resume logic based on type
  if (transaction.type === TransactionType.COMMIT) {
    // Resume logic for commit transaction
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: 'Resuming commit transaction',
      timestamp: new Date()
    });
    
    // Placeholder for implementation - would call appropriate transaction service
    return true;
  } else if (transaction.type === TransactionType.REVEAL) {
    // Resume logic for reveal transaction
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: 'Resuming reveal transaction',
      timestamp: new Date()
    });
    
    // Placeholder for implementation - would call appropriate transaction service
    return true;
  }
  
  return false;
}

/**
 * Check if a UTXO has been spent
 * 
 * @param txid Transaction ID
 * @param vout Output index
 * @returns True if the UTXO has been spent
 */
export async function isUtxoSpent(txid: string, vout: number): Promise<boolean> {
  // Placeholder implementation - would call blockchain API
  // In a real implementation, this would query a blockchain API to check if the UTXO has been spent
  return false;
}

/**
 * Check system health
 * 
 * @returns True if the system is healthy
 */
export async function checkSystemHealth(): Promise<{
  healthy: boolean;
  services: Record<string, boolean>;
  message?: string;
}> {
  // Placeholder for a real health check implementation
  // In a production system, this would check API endpoints, network connectivity, etc.
  const services = {
    blockchain: true,
    wallet: true,
    database: true,
    api: true
  };
  
  const healthy = Object.values(services).every(status => status);
  
  return {
    healthy,
    services,
    message: healthy ? 'All systems operational' : 'Some services are experiencing issues'
  };
}

/**
 * Get recovery suggestions for an error
 * 
 * @param error The error to get suggestions for
 * @returns Array of recovery suggestion strings
 */
export function getRecoverySuggestions(error: InscriptionError): string[] {
  if (error.recoverable === false) {
    return ['This error cannot be automatically recovered from. Please try again from the beginning.'];
  }
  
  // Return suggestions based on error category and code
  switch (error.category) {
    case ErrorCategory.NETWORK:
      return [
        'Check your internet connection and try again',
        'The server may be temporarily unavailable, wait a moment and retry',
        'If the problem persists, try using a different network connection'
      ];
      
    case ErrorCategory.WALLET:
      return [
        'Ensure your wallet is unlocked and connected',
        'Check that you have sufficient funds for the transaction',
        'Try reconnecting your wallet',
        'Refresh your UTXOs to get the latest balance'
      ];
      
    case ErrorCategory.VALIDATION:
      return [
        'Review your input values and correct any errors',
        'Ensure the content size is within acceptable limits',
        'Check that all required fields are filled in correctly'
      ];
      
    // Use string literals for comparison since ErrorCategory might not have these values yet
    case 'TRANSACTION' as unknown as ErrorCategory:
      if (error.code === ErrorCode.UTXO_ALREADY_SPENT) {
        return [
          'The selected UTXO has already been spent. Please refresh your UTXOs and select another one.',
          'Wait for your wallet to sync completely before trying again'
        ];
      }
      if (error.code === ErrorCode.INSUFFICIENT_FUNDS) {
        return [
          'You need additional funds to complete this transaction',
          'Select a UTXO with a higher balance',
          'Try reducing the fee rate to lower the total cost'
        ];
      }
      return [
        'Try submitting the transaction again',
        'Use a higher fee rate if the transaction is being rejected',
        'Check the transaction parameters for any errors'
      ];
      
    case 'INSCRIPTION' as unknown as ErrorCategory:
      return [
        'Try simplifying your inscription content',
        'Check that the content type is supported',
        'Ensure your inscription metadata is correctly formatted'
      ];
      
    default:
      // Generic suggestions for other error types
      return [
        'Try the operation again',
        'Refresh the page and start over',
        'If the problem persists, contact support'
      ];
  }
}

/**
 * State preservation utilities
 */
export const statePreservation = {
  /**
   * Save state to local storage
   * 
   * @param key Storage key
   * @param state State to save
   */
  saveState: <T>(key: string, state: T): void => {
    try {
      const stateString = JSON.stringify(state);
      localStorage.setItem(`ordinalsplus_${key}`, stateString);
    } catch (error) {
      console.warn('Failed to save state:', error);
    }
  },
  
  /**
   * Load state from local storage
   * 
   * @param key Storage key
   * @returns The saved state or null if not found
   */
  loadState: <T>(key: string): T | null => {
    try {
      const stateString = localStorage.getItem(`ordinalsplus_${key}`);
      if (!stateString) return null;
      return JSON.parse(stateString) as T;
    } catch (error) {
      console.warn('Failed to load state:', error);
      return null;
    }
  },
  
  /**
   * Clear saved state
   * 
   * @param key Storage key
   */
  clearState: (key: string): void => {
    try {
      localStorage.removeItem(`ordinalsplus_${key}`);
    } catch (error) {
      console.warn('Failed to clear state:', error);
    }
  }
};

/**
 * Transaction recovery utilities
 */
export const transactionRecovery = {
  /**
   * Check for any interrupted transactions and offer to resume them
   * 
   * @returns Array of transactions that can be resumed
   */
  findInterruptedTransactions: (): string[] => {
    const allTransactions = transactionTracker.getAllTransactions();
    return allTransactions
      .filter((tx: TrackedTransaction) => 
        (tx.status === TransactionStatus.PENDING || 
         tx.status === TransactionStatus.MEMPOOL) &&
        // Only include transactions that were started in the last 24 hours
        (new Date().getTime() - tx.createdAt.getTime() < 24 * 60 * 60 * 1000)
      )
      .map((tx: TrackedTransaction) => tx.id);
  },
  
  /**
   * Resume an interrupted transaction flow
   * 
   * @param transactionId The ID of the transaction to resume
   * @returns True if the transaction was resumed successfully
   */
  resumeTransactionFlow: async (transactionId: string): Promise<boolean> => {
    return await resumeTransaction(transactionId);
  }
}; 