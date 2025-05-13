/**
 * Error Recovery Utilities
 * 
 * This module provides recovery mechanisms for handling common error scenarios
 * in the inscription process, including network disconnections, UTXO issues,
 * and transaction failures.
 */

import { ErrorCode, InscriptionError, errorHandler } from './error-handler';
import { Utxo } from '../types';

/**
 * Maximum number of automatic retry attempts
 */
const MAX_RETRY_ATTEMPTS = 3;

/**
 * Base exponential backoff time in milliseconds
 */
const BASE_BACKOFF_TIME = 1000; // 1 second

/**
 * Interface for retry configuration
 */
export interface RetryConfig {
  maxAttempts?: number;
  baseBackoffTime?: number;
  onRetry?: (attempt: number, delay: number) => void;
  onSuccess?: () => void;
  onMaxAttemptsReached?: () => void;
}

/**
 * Recovery actions that can be taken for errors
 */
export enum RecoveryAction {
  RETRY = 'retry',
  REFRESH_UTXOS = 'refresh_utxos',
  INCREASE_FEE = 'increase_fee',
  RECONNECT_WALLET = 'reconnect_wallet',
  RESTART_PROCESS = 'restart_process',
  MANUAL_INTERVENTION = 'manual_intervention',
}

/**
 * Interface for recovery suggestions
 */
export interface RecoverySuggestion {
  action: RecoveryAction;
  message: string;
  automaticRecovery?: boolean;
}

/**
 * Get recovery suggestions for an error
 */
export function getRecoverySuggestions(error: InscriptionError): RecoverySuggestion[] {
  switch (error.code) {
    case ErrorCode.NETWORK_DISCONNECTED:
    case ErrorCode.REQUEST_TIMEOUT:
    case ErrorCode.API_ERROR:
      return [
        {
          action: RecoveryAction.RETRY,
          message: 'Retry the operation',
          automaticRecovery: true,
        },
        {
          action: RecoveryAction.MANUAL_INTERVENTION,
          message: 'Check your internet connection',
          automaticRecovery: false,
        },
      ];
      
    case ErrorCode.INSUFFICIENT_FUNDS:
      return [
        {
          action: RecoveryAction.MANUAL_INTERVENTION,
          message: 'Add more funds to your wallet',
          automaticRecovery: false,
        },
      ];
      
    case ErrorCode.WALLET_CONNECTION_FAILED:
      return [
        {
          action: RecoveryAction.RECONNECT_WALLET,
          message: 'Reconnect your wallet',
          automaticRecovery: true,
        },
        {
          action: RecoveryAction.MANUAL_INTERVENTION,
          message: 'Ensure your wallet is unlocked and accessible',
          automaticRecovery: false,
        },
      ];
      
    case ErrorCode.WALLET_REJECTED:
      return [
        {
          action: RecoveryAction.RETRY,
          message: 'Try the transaction again',
          automaticRecovery: false,
        },
        {
          action: RecoveryAction.MANUAL_INTERVENTION,
          message: 'Make sure to approve the transaction in your wallet',
          automaticRecovery: false,
        },
      ];
      
    case ErrorCode.UTXO_ALREADY_SPENT:
    case ErrorCode.INVALID_UTXO:
      return [
        {
          action: RecoveryAction.REFRESH_UTXOS,
          message: 'Refresh UTXOs and select a different one',
          automaticRecovery: true,
        },
      ];
      
    case ErrorCode.TRANSACTION_REJECTED:
    case ErrorCode.TRANSACTION_TIMEOUT:
      return [
        {
          action: RecoveryAction.INCREASE_FEE,
          message: 'Try again with a higher fee rate',
          automaticRecovery: false,
        },
        {
          action: RecoveryAction.RETRY,
          message: 'Retry the transaction',
          automaticRecovery: true,
        },
      ];
      
    case ErrorCode.COMMIT_TX_FAILED:
      return [
        {
          action: RecoveryAction.RETRY,
          message: 'Retry the commit transaction',
          automaticRecovery: true,
        },
        {
          action: RecoveryAction.RESTART_PROCESS,
          message: 'Start the inscription process over',
          automaticRecovery: false,
        },
      ];
      
    case ErrorCode.REVEAL_TX_FAILED:
      return [
        {
          action: RecoveryAction.RETRY,
          message: 'Retry the reveal transaction',
          automaticRecovery: true,
        },
        {
          action: RecoveryAction.MANUAL_INTERVENTION,
          message: 'Check if commit transaction is confirmed',
          automaticRecovery: false,
        },
      ];
      
    default:
      return [
        {
          action: RecoveryAction.RETRY,
          message: 'Retry the operation',
          automaticRecovery: false,
        },
        {
          action: RecoveryAction.MANUAL_INTERVENTION,
          message: 'Manual intervention may be required',
          automaticRecovery: false,
        },
      ];
  }
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const {
    maxAttempts = MAX_RETRY_ATTEMPTS,
    baseBackoffTime = BASE_BACKOFF_TIME,
    onRetry,
    onSuccess,
    onMaxAttemptsReached,
  } = config;
  
  let attempt = 0;
  
  while (true) {
    try {
      attempt++;
      const result = await fn();
      
      if (onSuccess) {
        onSuccess();
      }
      
      return result;
    } catch (error) {
      // If we've reached max attempts, throw the error
      if (attempt >= maxAttempts) {
        if (onMaxAttemptsReached) {
          onMaxAttemptsReached();
        }
        throw error;
      }
      
      // Calculate backoff delay with exponential increase and jitter
      const delay = Math.min(
        baseBackoffTime * Math.pow(2, attempt - 1) * (0.5 + Math.random()),
        30000 // Cap at 30 seconds
      );
      
      if (onRetry) {
        onRetry(attempt, delay);
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Refresh UTXOs when the selected one is already spent
 */
export async function handleUtxoError(
  error: InscriptionError,
  refreshUtxos: () => Promise<Utxo[]>,
  currentUtxo?: Utxo
): Promise<Utxo[]> {
  if (
    error.code === ErrorCode.UTXO_ALREADY_SPENT ||
    error.code === ErrorCode.INVALID_UTXO
  ) {
    const utxos = await refreshUtxos();
    
    // Filter out the problematic UTXO
    if (currentUtxo) {
      return utxos.filter(
        utxo => !(utxo.txid === currentUtxo.txid && utxo.vout === currentUtxo.vout)
      );
    }
    
    return utxos;
  }
  
  throw error; // Re-throw if it's not a UTXO error
}

/**
 * Handles network disconnection errors
 */
export async function handleNetworkError(
  error: InscriptionError,
  operation: () => Promise<any>
): Promise<any> {
  if (
    error.code === ErrorCode.NETWORK_DISCONNECTED ||
    error.code === ErrorCode.REQUEST_TIMEOUT ||
    error.code === ErrorCode.API_ERROR
  ) {
    return withRetry(operation, {
      onRetry: (attempt, delay) => {
        console.log(`Network error, retrying (${attempt}/${MAX_RETRY_ATTEMPTS}) in ${Math.round(delay / 1000)}s...`);
      },
    });
  }
  
  throw error; // Re-throw if it's not a network error
}

/**
 * Handles transaction state preservation and resumption
 */
export function preserveTransactionState(txData: any): string {
  try {
    // Store transaction data in localStorage for resumption
    const stateKey = `tx_state_${Date.now()}`;
    localStorage.setItem(stateKey, JSON.stringify(txData));
    return stateKey;
  } catch (error) {
    console.error('Failed to preserve transaction state:', error);
    return '';
  }
}

/**
 * Restore transaction state from storage
 */
export function restoreTransactionState(stateKey: string): any {
  try {
    const stateData = localStorage.getItem(stateKey);
    if (!stateData) return null;
    
    return JSON.parse(stateData);
  } catch (error) {
    console.error('Failed to restore transaction state:', error);
    return null;
  }
}

/**
 * Clear transaction state from storage
 */
export function clearTransactionState(stateKey: string): void {
  try {
    localStorage.removeItem(stateKey);
  } catch (error) {
    console.error('Failed to clear transaction state:', error);
  }
}

/**
 * Check system health before critical operations
 */
export async function checkSystemHealth(): Promise<boolean> {
  try {
    // Check wallet connection
    const isWalletConnected = await checkWalletConnection();
    if (!isWalletConnected) {
      errorHandler.createError(
        ErrorCode.WALLET_CONNECTION_FAILED,
        null,
        'Wallet connection check failed'
      );
      return false;
    }
    
    // Check network connectivity
    const isNetworkConnected = await checkNetworkConnectivity();
    if (!isNetworkConnected) {
      errorHandler.createError(
        ErrorCode.NETWORK_DISCONNECTED,
        null,
        'Network connectivity check failed'
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Health check failed:', error);
    return false;
  }
}

/**
 * Check wallet connection status
 */
async function checkWalletConnection(): Promise<boolean> {
  // Implementation would depend on the wallet provider being used
  // This is a placeholder implementation
  return true;
}

/**
 * Check network connectivity
 */
async function checkNetworkConnectivity(): Promise<boolean> {
  try {
    // Simple ping to check if we're online
    const response = await fetch('https://api.github.com/zen', { 
      method: 'GET',
      cache: 'no-cache'
    });
    return response.ok;
  } catch (error) {
    console.error('Network connectivity check failed:', error);
    return false;
  }
}

/**
 * Check if a transaction was actually broadcast successfully despite an error
 */
export async function checkTransactionBroadcast(
  txid: string,
  checkTxStatus: (txid: string) => Promise<{ confirmed: boolean }>
): Promise<boolean> {
  try {
    // Attempt to look up the transaction
    const status = await checkTxStatus(txid);
    return !!status;
  } catch (error) {
    // If we get an error looking up the transaction, it likely wasn't broadcast
    return false;
  }
} 