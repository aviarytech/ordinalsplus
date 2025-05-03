/**
 * Error Handling Integration Tests
 * 
 * Tests the error handling system in realistic usage scenarios
 */

import { InscriptionError, ErrorCategory, ErrorSeverity, ErrorCode, errorHandler } from '../src/utils/error-handler';
import { TransactionStatus, TransactionStatusTracker, transactionTracker } from '../src/transactions/transaction-status-tracker';
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';

// Mock console methods to verify logging
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

describe('Error Handling Integration Tests', () => {
  let consoleErrorMock: jest.SpyInstance;
  let consoleWarnMock: jest.SpyInstance;
  
  beforeEach(() => {
    // Reset error log
    errorHandler.clearErrorLog();
    
    // Mock console methods
    consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnMock = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    // Restore console methods
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
    
    // Restore spy mocks
    jest.restoreAllMocks();
  });
  
  it('should create and log structured errors from network failure', async () => {
    // Mock a network error scenario
    const mockNetworkError = new Error('Failed to connect to API endpoint');
    
    // Create a structured error
    const structuredError = errorHandler.createError({
      code: ErrorCode.NETWORK_ERROR,
      message: mockNetworkError.message,
      details: 'Unable to reach blockchain API service',
      category: ErrorCategory.NETWORK,
      severity: ErrorSeverity.ERROR,
      recoverable: true,
      suggestion: 'Check your internet connection and try again.'
    });
    
    // Log the error
    errorHandler.logError(structuredError);
    
    // Verify error was logged
    expect(consoleErrorMock).toHaveBeenCalled();
    
    // Verify error is in the log
    const errorLog = errorHandler.getErrorLog();
    expect(errorLog).toHaveLength(1);
    expect(errorLog[0].code).toBe(ErrorCode.NETWORK_ERROR);
    expect(errorLog[0].category).toBe(ErrorCategory.NETWORK);
  });
  
  it('should integrate with transaction status tracker to handle transaction errors', () => {
    // Create a unique transaction ID
    const txId = `test-tx-${Date.now()}`;
    
    // Add a test transaction
    transactionTracker.addTransaction({
      id: txId,
      txid: '',
      type: 'REVEAL',
      status: TransactionStatus.PENDING,
      createdAt: new Date(),
      lastUpdatedAt: new Date()
    });
    
    // Create an error
    const txError = errorHandler.createError({
      code: ErrorCode.TRANSACTION_BROADCAST_FAILED,
      message: 'Failed to broadcast transaction',
      details: 'Network rejected transaction due to insufficient fee',
      category: ErrorCategory.TRANSACTION,
      severity: ErrorSeverity.ERROR
    });
    
    // Set error on transaction
    transactionTracker.setTransactionError(txId, txError);
    transactionTracker.setTransactionStatus(txId, TransactionStatus.FAILED);
    
    // Verify that transaction has error
    const tx = transactionTracker.getTransaction(txId);
    expect(tx).toBeDefined();
    expect(tx?.status).toBe(TransactionStatus.FAILED);
    expect(tx?.error).toBeDefined();
    expect(tx?.error?.code).toBe(ErrorCode.TRANSACTION_BROADCAST_FAILED);
    
    // Verify error was logged
    expect(consoleErrorMock).toHaveBeenCalled();
    expect(errorHandler.getErrorLog()).toContainEqual(expect.objectContaining({
      code: ErrorCode.TRANSACTION_BROADCAST_FAILED
    }));
  });
  
  it('should handle multiple related errors with child relationships', () => {
    // Create parent error
    const parentError = errorHandler.createError({
      code: ErrorCode.INSCRIPTION_CREATION_FAILED,
      message: 'Failed to create inscription',
      category: ErrorCategory.INSCRIPTION,
      severity: ErrorSeverity.ERROR
    });
    
    // Log parent error
    errorHandler.logError(parentError);
    
    // Create child error with parent reference
    const childError = errorHandler.createError({
      code: ErrorCode.UTXO_SELECTION_FAILED,
      message: 'Failed to select appropriate UTXOs',
      category: ErrorCategory.WALLET,
      severity: ErrorSeverity.ERROR,
      parentError: parentError
    });
    
    // Log child error
    errorHandler.logError(childError);
    
    // Verify both errors were logged
    const errorLog = errorHandler.getErrorLog();
    expect(errorLog).toHaveLength(2);
    
    // Find the child error
    const loggedChildError = errorLog.find(e => e.code === ErrorCode.UTXO_SELECTION_FAILED);
    expect(loggedChildError).toBeDefined();
    expect(loggedChildError?.parentError).toBeDefined();
    expect(loggedChildError?.parentError?.code).toBe(ErrorCode.INSCRIPTION_CREATION_FAILED);
  });
  
  it('should provide user-friendly messages for technical errors', () => {
    // Create a technical error
    const technicalError = errorHandler.createError({
      code: ErrorCode.SCRIPT_VALIDATION_FAILED,
      message: 'Script failed policy: mandatory-script-verify-flag-failed (Signature must be zero for failed CHECK(MULTI)SIG operation)',
      category: ErrorCategory.VALIDATION,
      severity: ErrorSeverity.ERROR
    });
    
    // Get user-friendly message
    const userFriendlyMessage = errorHandler.getUserFriendlyMessage(technicalError);
    
    // Verify the message is more user-friendly
    expect(userFriendlyMessage).not.toBe(technicalError.message);
    expect(userFriendlyMessage.length).toBeLessThan(technicalError.message.length);
    expect(userFriendlyMessage).not.toContain('CHECK(MULTI)SIG operation');
  });
  
  it('should allow recovery from certain errors', async () => {
    // Create a recoverable error
    const recoveryError = errorHandler.createError({
      code: ErrorCode.TEMPORARY_SERVER_ERROR,
      message: 'Temporary server error occurred',
      category: ErrorCategory.SERVER,
      severity: ErrorSeverity.WARNING,
      recoverable: true,
      suggestion: 'The server may be overloaded, please try again in a moment.'
    });
    
    // Check if error is recoverable
    expect(errorHandler.isRecoverable(recoveryError)).toBe(true);
    
    // Mock a function that fails initially but succeeds after retries
    let attempts = 0;
    const mockOperation = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw recoveryError;
      }
      return 'success';
    });
    
    // Try the operation with retry logic
    const result = await errorHandler.retryOperation(mockOperation, {
      maxRetries: 5,
      initialDelay: 10,
      factor: 1.5
    });
    
    // Verify operation succeeded after retries
    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });
}); 