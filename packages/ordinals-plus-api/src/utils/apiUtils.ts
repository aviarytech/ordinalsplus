/**
 * API Utilities for Error Handling and Retry Logic
 * 
 * This module provides utilities for API error handling, retry mechanisms,
 * and circuit breaker pattern implementation for API clients.
 */

import fetchClient, { createFetchClient } from './fetchUtils';
import type { FetchError, FetchRequestConfig, FetchResponse } from './fetchUtils';

// ===========================================
// Error Classes
// ===========================================

/**
 * Base API Error class
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Network-related errors (connectivity issues)
 */
export class NetworkError extends ApiError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'NETWORK_ERROR', originalError);
    this.name = 'NetworkError';
  }
}

/**
 * Authentication errors (invalid credentials, token expired)
 */
export class AuthenticationError extends ApiError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', originalError);
    this.name = 'AuthenticationError';
  }
}

/**
 * Validation errors (invalid request data)
 */
export class ValidationError extends ApiError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'VALIDATION_ERROR', originalError);
    this.name = 'ValidationError';
  }
}

/**
 * Server errors (unexpected API server issues)
 */
export class ServerError extends ApiError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'SERVER_ERROR', originalError);
    this.name = 'ServerError';
  }
}

/**
 * Rate limit errors
 */
export class RateLimitError extends ApiError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'RATE_LIMIT_ERROR', originalError);
    this.name = 'RateLimitError';
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitBreakerOpenError extends ApiError {
  constructor(message: string, originalError?: unknown) {
    super(message, 'CIRCUIT_BREAKER_OPEN', originalError);
    this.name = 'CircuitBreakerOpenError';
  }
}

// ===========================================
// Retry Configuration
// ===========================================

/**
 * Retry options for API calls
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Initial delay in milliseconds */
  initialDelay: number;
  /** Backoff multiplier for each retry */
  backoffFactor: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Jitter factor (0-1) to randomize delay */
  jitterFactor: number;
  /** Optional callback to execute before each retry */
  onRetry?: (retryCount: number, error: Error, delayMs: number) => void;
  /** Predicate to determine if an error is retryable */
  isRetryable?: (error: Error) => boolean;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 300,
  backoffFactor: 2,
  maxDelay: 30000,
  jitterFactor: 0.2,
  isRetryable: (error: Error) => {
    // Network errors and certain types of server errors are retryable by default
    if (error instanceof NetworkError) return true;
    if (error instanceof ServerError) return true;
    if (error instanceof RateLimitError) return true;
    
    // Authentication and validation errors are not retryable by default
    if (error instanceof AuthenticationError) return false;
    if (error instanceof ValidationError) return false;
    
    // For unknown error types, use a conservative approach
    return false;
  }
};

// ===========================================
// Retry Implementation
// ===========================================

/**
 * Calculate retry delay with exponential backoff and jitter
 * 
 * @param retryCount Current retry attempt number (starting from 1)
 * @param options Retry options
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(retryCount: number, options: RetryOptions): number {
  // Base delay with exponential backoff
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffFactor, retryCount - 1);
  
  // Apply maximum delay cap
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);
  
  // Apply jitter to prevent thundering herd problem
  const jitter = 1 - options.jitterFactor + (Math.random() * options.jitterFactor * 2);
  
  return Math.floor(cappedDelay * jitter);
}

/**
 * Execute a function with retry logic
 * 
 * @param fn Function to execute and potentially retry
 * @param options Retry options
 * @returns Promise resolving to the function result
 * @throws Last error encountered after all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const retryOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  let lastError: Error;
  let attempt = 0;

  while (attempt <= retryOptions.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;
      
      // Check if we've reached the maximum retries
      if (attempt > retryOptions.maxRetries) {
        break;
      }
      
      // Check if this error type is retryable
      const isRetryable = retryOptions.isRetryable?.(lastError) ?? false;
      if (!isRetryable) {
        break;
      }
      
      // Calculate delay for next retry
      const delayMs = calculateRetryDelay(attempt, retryOptions);
      
      // Execute onRetry callback if provided
      if (retryOptions.onRetry) {
        retryOptions.onRetry(attempt, lastError, delayMs);
      }
      
      // Wait before trying again
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw lastError!;
}

// ===========================================
// Fetch Error Handling
// ===========================================

/**
 * Classify a Fetch error into our custom error types
 * 
 * @param error The error to classify
 * @param defaultMessage Default message to use if none can be extracted
 * @returns A classified ApiError
 */
export function classifyFetchError(error: unknown, defaultMessage = 'API request failed'): ApiError {
  if (fetchClient.isFetchError(error)) {
    const fetchError = error as FetchError;
    
    if (fetchError.response) {
      // API responded with an error status
      const status = fetchError.status || 0;
      const data = fetchError.data;
      
      // Extract error message from response data if possible
      const message = extractErrorMessage(data) || fetchError.message || defaultMessage;
      
      // Classify by status code
      if (status === 401 || status === 403) {
        return new AuthenticationError(message, error);
      } else if (status === 400 || status === 422) {
        return new ValidationError(message, error);
      } else if (status === 429) {
        return new RateLimitError(message, error);
      } else if (status >= 500) {
        return new ServerError(message, error);
      }
      
      // Default case for other status codes
      return new ApiError(message, `HTTP_${status}`, error);
    } else if (fetchError.request) {
      // Request was made but no response received (network error)
      return new NetworkError(`Network error: ${fetchError.message || defaultMessage}`, error);
    } else if (fetchError.isNetworkError) {
      return new NetworkError(`Network error: ${fetchError.message || defaultMessage}`, error);
    }
  }
  
  if (error instanceof Error) {
    // Non-Fetch errors
    return new ApiError(
      error.message || defaultMessage,
      'UNKNOWN_ERROR',
      error
    );
  }
  
  // Fallback for non-Error objects
  return new ApiError(
    defaultMessage,
    'UNKNOWN_ERROR',
    error
  );
}

/**
 * Extract error message from API response data
 * 
 * @param data Response data to extract from
 * @returns Extracted error message or undefined
 */
function extractErrorMessage(data: any): string | undefined {
  if (!data) return undefined;
  
  // Handle string data
  if (typeof data === 'string') {
    return data;
  }
  
  // Common error message patterns in APIs
  if (typeof data === 'object') {
    // Try various common patterns
    return data.message || 
           data.error?.message || 
           data.error || 
           data.errorMessage ||
           data.error_message ||
           data.errorDescription ||
           data.error_description ||
           undefined;
  }
  
  return undefined;
}

// ===========================================
// Circuit Breaker Implementation
// ===========================================

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation, requests go through
  OPEN = 'OPEN',         // Failure threshold reached, reject requests
  HALF_OPEN = 'HALF_OPEN' // Trial period, allowing limited requests
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Reset timeout in milliseconds */
  resetTimeout: number;
  /** For half-open state, number of successful requests to close the circuit */
  successThreshold: number;
  /** Function to determine if an error should count as a failure */
  isFailure?: (error: Error) => boolean;
  /** Called when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/**
 * Default circuit breaker options
 */
export const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000,
  successThreshold: 2,
  isFailure: (error: Error) => {
    // By default, network and server errors count as failures
    return error instanceof NetworkError || error instanceof ServerError;
  }
};

/**
 * Circuit breaker implementation for API calls
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private resetTimeoutId: ReturnType<typeof setTimeout> | null = null;
  
  constructor(private options: CircuitBreakerOptions = DEFAULT_CIRCUIT_BREAKER_OPTIONS) {}
  
  /**
   * Execute a function with circuit breaker protection
   * 
   * @param fn Function to execute
   * @returns Promise resolving to the function result
   * @throws CircuitBreakerOpenError if circuit is open
   * @throws Original error if the function fails
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeout) {
        this.toHalfOpen();
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker is open. Rejecting request for ${this.options.resetTimeout - (Date.now() - this.lastFailureTime)}ms more.`
        );
      }
    }
    
    try {
      const result = await fn();
      
      // Handle success
      this.onSuccess();
      
      return result;
    } catch (error) {
      // Handle failure
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      
      // Re-throw the original error
      throw error;
    }
  }
  
  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      
      if (this.successCount >= this.options.successThreshold) {
        this.toClosed();
      }
    }
  }
  
  /**
   * Handle failed execution
   * 
   * @param error The error that occurred
   */
  private onFailure(error: Error): void {
    // Check if error counts as a failure
    const isFailure = this.options.isFailure?.(error) ?? true;
    
    if (!isFailure) {
      return;
    }
    
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.CLOSED) {
      this.failureCount++;
      
      if (this.failureCount >= this.options.failureThreshold) {
        this.toOpen();
      }
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.toOpen();
    }
  }
  
  /**
   * Transition to closed state
   */
  private toClosed(): void {
    if (this.state !== CircuitState.CLOSED) {
      const previousState = this.state;
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
      this.successCount = 0;
      
      if (this.resetTimeoutId) {
        clearTimeout(this.resetTimeoutId);
        this.resetTimeoutId = null;
      }
      
      if (this.options.onStateChange) {
        this.options.onStateChange(previousState, CircuitState.CLOSED);
      }
    }
  }
  
  /**
   * Transition to open state
   */
  private toOpen(): void {
    if (this.state !== CircuitState.OPEN) {
      const previousState = this.state;
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      
      if (this.resetTimeoutId) {
        clearTimeout(this.resetTimeoutId);
      }
      
      this.resetTimeoutId = setTimeout(() => {
        this.toHalfOpen();
      }, this.options.resetTimeout);
      
      if (this.options.onStateChange) {
        this.options.onStateChange(previousState, CircuitState.OPEN);
      }
    }
  }
  
  /**
   * Transition to half-open state
   */
  private toHalfOpen(): void {
    if (this.state !== CircuitState.HALF_OPEN) {
      const previousState = this.state;
      this.state = CircuitState.HALF_OPEN;
      this.successCount = 0;
      
      if (this.resetTimeoutId) {
        clearTimeout(this.resetTimeoutId);
        this.resetTimeoutId = null;
      }
      
      if (this.options.onStateChange) {
        this.options.onStateChange(previousState, CircuitState.HALF_OPEN);
      }
    }
  }
  
  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.toClosed();
  }
}

// ===========================================
// Create Fetch Client with Retry and Circuit Breaker
// ===========================================

// Node environments might need to import fetch if not available globally
// import fetch from 'node-fetch';

/**
 * Options for creating a resilient API client
 */
export interface ResilientClientOptions {
  /** Base URL for API requests */
  baseURL: string;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Retry options */
  retry?: Partial<RetryOptions>;
  /** Circuit breaker options */
  circuitBreaker?: Partial<CircuitBreakerOptions>;
  /** Default headers */
  headers?: Record<string, string>;
}

/**
 * Creates an Fetch client with retry and circuit breaker capabilities
 * 
 * @param options Client configuration
 * @returns Configured Fetch instance
 */
export function createResilientClient(options: ResilientClientOptions) {
  // Create base fetch config
  const fetchConfig: FetchRequestConfig = {
    baseURL: options.baseURL,
    timeout: options.timeout || 30000,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };
  
  // Add API key if provided
  if (options.apiKey) {
    fetchConfig.headers = {
      ...fetchConfig.headers,
      'Authorization': `Bearer ${options.apiKey}`
    };
  }
  
  // Create the fetch client instance
  const client = createFetchClient(fetchConfig);
  
  // Initialize circuit breaker
  const circuitBreakerOptions: CircuitBreakerOptions = {
    ...DEFAULT_CIRCUIT_BREAKER_OPTIONS,
    ...options.circuitBreaker
  };
  const circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
  
  // Initialize retry options
  const retryOptions: RetryOptions = {
    ...DEFAULT_RETRY_OPTIONS,
    ...options.retry
  };
  
  // We can't use interceptors with our fetch client, but we can wrap the methods
  // to add logging functionality
  const originalRequest = client.request;
  client.request = async <T = any>(config: FetchRequestConfig): Promise<FetchResponse<T>> => {
    // Log request details (sanitizing sensitive headers)
    const sanitizedHeaders = { ...config.headers };
    if (sanitizedHeaders && sanitizedHeaders.Authorization) {
      sanitizedHeaders.Authorization = '**REDACTED**';
    }
    
    console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`, {
      headers: sanitizedHeaders,
      params: config.params
    });
    
    try {
      const response = await originalRequest(config);
      
      // Log successful response
      console.log(`Response: ${response.status} ${response.config.url}`, {
        data: response.data
      });
      
      return response;
    } catch (error) {
      // Log error response
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        config,
        error
      });
      
      // Classify the error
      const apiError = classifyFetchError(error);
      
      // Re-throw the classified error
      throw apiError;
    }
  };
  
  // Add circuit breaker and retry capabilities
  const wrappedRequest = client.request;
  client.request = async <T = any>(config: FetchRequestConfig): Promise<FetchResponse<T>> => {
    // Use circuit breaker to protect the request
    return circuitBreaker.execute(async () => {
      // Use retry logic for the request
      return withRetry(
        async () => wrappedRequest<T>(config),
        retryOptions
      );
    });
  };
  
  return client;
} 