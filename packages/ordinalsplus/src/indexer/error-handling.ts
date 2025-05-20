/**
 * Error handling utilities for the Ordinals Indexer
 * Exports all error handling related components for easy importing
 */

// Re-export everything from the utilities
export * from './errors';
export * from './retry';
export * from './dlq';
export * from './logger';

// Export additional functions specific to error handling integration

import { Logger } from './logger';
import { DeadLetterQueue, MemoryDLQStorage } from './dlq';
import { CircuitBreaker, RetryOptions, withRetry } from './retry';
import { formatError, transformError, IndexerIntegrationError } from './errors';

/**
 * Default memory-based DLQ instance
 */
export const defaultDLQ = new DeadLetterQueue(new MemoryDLQStorage());

/**
 * Configuration for the error handler system
 */
export interface ErrorHandlerConfig {
  /**
   * Logger instance to use
   */
  logger: Logger;
  
  /**
   * Dead Letter Queue to use
   */
  dlq: DeadLetterQueue;
  
  /**
   * Default retry options
   */
  defaultRetryOptions?: Partial<RetryOptions>;
  
  /**
   * Default circuit breaker service key
   */
  defaultServiceKey?: string;
}

/**
 * Integration options for error handler
 */
export interface ErrorHandlerOptions {
  /**
   * Operation name for DLQ entries
   */
  operation: string;
  
  /**
   * Whether to use circuit breaker for this operation
   */
  useCircuitBreaker?: boolean;
  
  /**
   * Circuit breaker service key, if different from default
   */
  circuitBreakerKey?: string;
  
  /**
   * Whether to use retries for this operation
   */
  useRetry?: boolean;
  
  /**
   * Retry options, if different from default
   */
  retryOptions?: Partial<RetryOptions>;
  
  /**
   * Whether to use DLQ for unrecoverable errors
   */
  useDLQ?: boolean;
  
  /**
   * Whether to throw the error after handling
   * (default: true for transparent error handling)
   */
  rethrow?: boolean;
}

/**
 * Centralized error handler for the Ordinals Indexer
 */
export class ErrorHandler {
  private config: ErrorHandlerConfig;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  
  /**
   * Creates a new ErrorHandler instance
   * 
   * @param config - Error handler configuration
   */
  constructor(config: ErrorHandlerConfig) {
    this.config = config;
  }
  
  /**
   * Gets or creates a circuit breaker for a service key
   * 
   * @param serviceKey - Service key to identify the circuit breaker
   * @returns A CircuitBreaker instance
   */
  private getCircuitBreaker(serviceKey: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceKey)) {
      this.circuitBreakers.set(serviceKey, new CircuitBreaker(serviceKey));
    }
    
    return this.circuitBreakers.get(serviceKey)!;
  }
  
  /**
   * Wraps a function with error handling
   * 
   * @param fn - Function to wrap
   * @param options - Error handling options
   * @returns A wrapped function with error handling
   */
  async handle<T>(
    fn: () => Promise<T>, 
    options: ErrorHandlerOptions,
    payload?: any
  ): Promise<T> {
    const {
      operation,
      useCircuitBreaker = false,
      circuitBreakerKey,
      useRetry = true,
      retryOptions,
      useDLQ = true,
      rethrow = true
    } = options;
    
    try {
      // If using circuit breaker, get the correct instance
      if (useCircuitBreaker) {
        const serviceKey = circuitBreakerKey || this.config.defaultServiceKey || 'default';
        const circuitBreaker = this.getCircuitBreaker(serviceKey);
        
        // If using retries, combine with circuit breaker
        if (useRetry) {
          return await withRetry(
            () => circuitBreaker.execute(fn),
            { ...this.config.defaultRetryOptions, ...retryOptions }
          );
        }
        
        // Just circuit breaker, no retries
        return await circuitBreaker.execute(fn);
      }
      
      // If using retries without circuit breaker
      if (useRetry) {
        return await withRetry(
          fn,
          { ...this.config.defaultRetryOptions, ...retryOptions }
        );
      }
      
      // No circuit breaker or retries
      return await fn();
    } catch (error) {
      // Transform to IndexerIntegrationError if it isn't already
      const transformedError = transformError(error, { operation });
      
      // Log the error
      this.config.logger.logError(
        transformedError, 
        `Error in operation: ${operation}`,
        { operation, payload }
      );
      
      // Add to DLQ if appropriate
      if (useDLQ && transformedError.isTransient === false) {
        try {
          const dlqId = await this.config.dlq.addEntry(
            operation,
            payload,
            transformedError
          );
          
          this.config.logger.info(`Added failed operation to DLQ with ID: ${dlqId}`, {
            operation,
            dlqId
          });
        } catch (dlqError) {
          this.config.logger.error('Failed to add entry to DLQ', {
            originalError: formatError(transformedError),
            dlqError
          });
        }
      }
      
      // Rethrow if requested
      if (rethrow) {
        throw transformedError;
      }
      
      // Return undefined if not rethrowing
      return undefined as unknown as T;
    }
  }
}

/**
 * Default error handler instance
 */
export const defaultErrorHandler = new ErrorHandler({
  logger: new Logger({ prefix: 'IndexerError' }),
  dlq: defaultDLQ
}); 