/**
 * Error definitions and handling utilities for Ordinals Indexer
 */

import { FetchError } from '../utils/fetchUtils';

/**
 * Base error class for all indexer-related errors
 */
export class IndexerIntegrationError extends Error {
  /** Original error that caused this error, if any */
  cause?: Error;
  
  /** Whether this error is considered transient and can be retried */
  readonly isTransient: boolean;
  
  /** Private storage for context information */
  private _context: Record<string, any>;
  
  constructor(
    message: string, 
    options: { 
      cause?: Error; 
      isTransient?: boolean; 
      context?: Record<string, any>
    } = {}
  ) {
    super(message);
    this.name = this.constructor.name;
    this.cause = options.cause;
    this.isTransient = options.isTransient ?? false;
    this._context = options.context ?? {};
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Get the context information for this error
   */
  get context(): Record<string, any> {
    return { ...this._context };
  }
  
  /**
   * Add additional context to the error
   * 
   * @param additionalContext - Context to add
   * @returns this (for chaining)
   */
  addContext(additionalContext: Record<string, any>): this {
    this._context = { ...this._context, ...additionalContext };
    return this;
  }
}

/**
 * Error thrown when there's a network-related issue (timeouts, connection refused, etc.)
 */
export class NetworkError extends IndexerIntegrationError {
  constructor(
    message: string, 
    options: { 
      cause?: Error; 
      context?: Record<string, any>;
      isTransient?: boolean;
    } = {}
  ) {
    super(message, { 
      cause: options.cause,
      context: options.context,
      // Network errors are considered transient by default
      isTransient: options.isTransient ?? true 
    });
  }
}

/**
 * Error thrown when the indexer API returns an error response
 */
export class IndexerAPIError extends IndexerIntegrationError {
  readonly statusCode?: number;
  
  constructor(
    message: string, 
    options: { 
      cause?: Error; 
      statusCode?: number;
      context?: Record<string, any>;
      isTransient?: boolean;
    } = {}
  ) {
    super(message, { 
      cause: options.cause,
      context: options.context,
      // API errors might be transient depending on the status code
      isTransient: options.isTransient ?? isTransientStatusCode(options.statusCode)
    });
    
    this.statusCode = options.statusCode;
  }
}

/**
 * Error thrown when there's an issue parsing or processing data
 */
export class DataParsingError extends IndexerIntegrationError {
  constructor(
    message: string, 
    options: { 
      cause?: Error; 
      context?: Record<string, any>
    } = {}
  ) {
    super(message, { 
      cause: options.cause,
      context: options.context,
      // Data parsing errors are not transient by default
      isTransient: false 
    });
  }
}

/**
 * Error thrown when there's an issue with the database operations
 */
export class DatabaseError extends IndexerIntegrationError {
  constructor(
    message: string, 
    options: { 
      cause?: Error; 
      context?: Record<string, any>;
      isTransient?: boolean;
    } = {}
  ) {
    super(message, { 
      cause: options.cause,
      context: options.context,
      // Some database errors might be transient
      isTransient: options.isTransient ?? false
    });
  }
}

/**
 * Error thrown when a circuit breaker is open
 */
export class CircuitBreakerOpenError extends IndexerIntegrationError {
  constructor(
    message: string, 
    options: { 
      context?: Record<string, any>
    } = {}
  ) {
    super(message, { 
      context: options.context,
      // Circuit breaker errors are transient but should not be immediately retried
      isTransient: true
    });
  }
}

/**
 * Transforms an error into an appropriate IndexerIntegrationError
 * 
 * @param error - The original error
 * @param context - Additional context to include in the error
 * @returns A standardized IndexerIntegrationError
 */
export function transformError(
  error: any, 
  context: Record<string, any> = {}
): IndexerIntegrationError {
  // Already an IndexerIntegrationError, just add context
  if (error instanceof IndexerIntegrationError) {
    return error.addContext(context);
  }
  
  // Handle Fetch errors
  if (isFetchError(error)) {
    // Handle network errors (no response or explicit network error)
    if (error.isNetworkError || !error.response) {
      return new NetworkError(
        `Network error: ${error.message}`, 
        { 
          cause: error, 
          context: { 
            ...context,
            url: error.request?.url,
            method: error.request?.method
          }
        }
      );
    }
    
    // API error (with response)
    const statusCode = error.status;
    const responseData = error.data;
    
    return new IndexerAPIError(
      `API error: ${error.message}`,
      {
        cause: error,
        statusCode,
        context: {
          ...context,
          statusCode,
          responseData,
          url: error.request?.url,
          method: error.request?.method
        }
      }
    );
  }
  
  // Handle database errors (pattern matching)
  if (error.message && 
      (error.message.includes('database') || 
       error.message.includes('db') || 
       error.message.toLowerCase().includes('connection'))) {
    return new DatabaseError(
      `Database error: ${error.message}`,
      { cause: error, context }
    );
  }
  
  // Handle CBOR/parsing errors
  if (error.message && 
      (error.message.includes('parsing') || 
       error.message.includes('decode') || 
       error.message.includes('invalid') ||
       error.message.includes('CBOR'))) {
    return new DataParsingError(
      `Data parsing error: ${error.message}`,
      { cause: error, context }
    );
  }
  
  // Generic fallback
  return new IndexerIntegrationError(
    `Unknown error: ${error.message || 'No error message'}`,
    { cause: error, context }
  );
}

/**
 * Type guard for Fetch errors
 */
function isFetchError(error: any): error is FetchError {
  return error && error.isNetworkError !== undefined;
}

/**
 * Determines if a status code is likely to be a transient error
 * 
 * @param statusCode - HTTP status code
 * @returns true if the error is considered transient/retryable
 */
function isTransientStatusCode(statusCode?: number): boolean {
  if (!statusCode) return false;
  
  // 408 Request Timeout
  // 429 Too Many Requests
  // 500 Internal Server Error
  // 502 Bad Gateway
  // 503 Service Unavailable
  // 504 Gateway Timeout
  return [408, 429, 500, 502, 503, 504].includes(statusCode);
}

/**
 * Returns a formatted string representation of an error for logging
 * 
 * @param error - The error to format
 * @returns Formatted error string with context
 */
export function formatError(error: any): string {
  if (error instanceof IndexerIntegrationError) {
    const contextStr = Object.keys(error.context).length > 0
      ? `\nContext: ${JSON.stringify(error.context, null, 2)}`
      : '';
    
    const causeStr = error.cause
      ? `\nCause: ${error.cause.message}`
      : '';
    
    return `${error.name}: ${error.message}${contextStr}${causeStr}`;
  }
  
  return error?.stack || error?.message || String(error);
} 