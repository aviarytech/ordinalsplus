/**
 * Error Handling System Tests
 * 
 * This test suite validates the comprehensive error handling
 * implementation for the ordinals inscription process.
 */

import { 
  ErrorCategory, 
  ErrorCode, 
  ErrorSeverity, 
  InscriptionError,
  errorHandler 
} from '../src/utils/error-handler';

import {
  RecoveryAction,
  getRecoverySuggestions,
  withRetry
} from '../src/utils/error-recovery';

describe('Error Handler', () => {
  beforeEach(() => {
    // Clear error log before each test
    errorHandler.clearErrorLog();
  });

  test('should create an error with proper structure', () => {
    const error = errorHandler.createError(
      ErrorCode.INSUFFICIENT_FUNDS,
      { requiredAmount: 10000, availableAmount: 5000 },
      'Not enough funds for inscription'
    );
    
    expect(error).toHaveProperty('code', ErrorCode.INSUFFICIENT_FUNDS);
    expect(error).toHaveProperty('message', 'Not enough funds for inscription');
    expect(error).toHaveProperty('category', ErrorCategory.WALLET);
    expect(error).toHaveProperty('severity', ErrorSeverity.ERROR);
    expect(error).toHaveProperty('timestamp');
    expect(error).toHaveProperty('details');
    expect(error).toHaveProperty('suggestion');
    expect(error).toHaveProperty('recoverable', true);
    
    expect(error.details).toEqual({ requiredAmount: 10000, availableAmount: 5000 });
  });

  test('should handle errors thrown from other parts of the codebase', () => {
    const originalError = new Error('Network request failed');
    const handledError = errorHandler.handleError(originalError);
    
    expect(handledError).toHaveProperty('code', ErrorCode.UNEXPECTED_ERROR);
    expect(handledError).toHaveProperty('message', 'Network request failed');
    expect(handledError).toHaveProperty('category', ErrorCategory.SYSTEM);
    expect(handledError).toHaveProperty('timestamp');
    expect(handledError).toHaveProperty('recoverable', false);
  });

  test('should add errors to the error log when created', () => {
    errorHandler.createError(ErrorCode.WALLET_CONNECTION_FAILED);
    errorHandler.createError(ErrorCode.INVALID_INPUT);
    
    const errorLog = errorHandler.getErrorLog();
    expect(errorLog).toHaveLength(2);
    expect(errorLog[0].code).toBe(ErrorCode.WALLET_CONNECTION_FAILED);
    expect(errorLog[1].code).toBe(ErrorCode.INVALID_INPUT);
  });

  test('should clear error log when requested', () => {
    errorHandler.createError(ErrorCode.WALLET_CONNECTION_FAILED);
    errorHandler.clearErrorLog();
    
    const errorLog = errorHandler.getErrorLog();
    expect(errorLog).toHaveLength(0);
  });

  test('should determine if an error is recoverable', () => {
    const recoverableError = errorHandler.createError(ErrorCode.NETWORK_DISCONNECTED);
    const unrecoverableError = errorHandler.createError(ErrorCode.UNEXPECTED_ERROR);
    
    expect(errorHandler.isRecoverable(recoverableError)).toBe(true);
    expect(errorHandler.isRecoverable(unrecoverableError)).toBe(false);
  });

  test('should provide user-friendly messages', () => {
    const error = errorHandler.createError(ErrorCode.INSUFFICIENT_FUNDS);
    const message = errorHandler.getUserFriendlyMessage(error);
    
    expect(message).toBe('Please add more funds to your wallet before creating an inscription.');
  });
});

describe('Error Recovery Mechanisms', () => {
  test('should provide recovery suggestions based on error type', () => {
    const networkError = errorHandler.createError(ErrorCode.NETWORK_DISCONNECTED);
    const suggestions = getRecoverySuggestions(networkError);
    
    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]).toHaveProperty('action', RecoveryAction.RETRY);
    expect(suggestions[0]).toHaveProperty('automaticRecovery', true);
    expect(suggestions[1]).toHaveProperty('action', RecoveryAction.MANUAL_INTERVENTION);
  });

  test('should retry operations with exponential backoff', async () => {
    // Mock function that fails twice and succeeds on the third attempt
    let attempts = 0;
    const mockOperation = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Transient error');
      }
      return 'success';
    });
    
    // Mock timers to avoid waiting for real backoff delays
    jest.useFakeTimers();
    
    // Start the retry process
    const retryPromise = withRetry(mockOperation, {
      maxAttempts: 3,
      baseBackoffTime: 100,
      onRetry: jest.fn(),
    });
    
    // Fast-forward through all timers to resolve the promise
    jest.runAllTimers();
    
    const result = await retryPromise;
    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(3);
    
    // Restore real timers
    jest.useRealTimers();
  });

  test('should give up after reaching maximum retry attempts', async () => {
    // Mock function that always fails
    const mockOperation = jest.fn().mockImplementation(() => {
      throw new Error('Persistent error');
    });
    
    // Mock timers to avoid waiting for real backoff delays
    jest.useFakeTimers();
    
    // Start the retry process with max 2 attempts
    const retryPromise = withRetry(mockOperation, {
      maxAttempts: 2,
      baseBackoffTime: 100,
      onRetry: jest.fn(),
      onMaxAttemptsReached: jest.fn(),
    });
    
    // Fast-forward through all timers
    jest.runAllTimers();
    
    // The promise should reject after max attempts
    await expect(retryPromise).rejects.toThrow('Persistent error');
    expect(mockOperation).toHaveBeenCalledTimes(2);
    
    // Restore real timers
    jest.useRealTimers();
  });
}); 