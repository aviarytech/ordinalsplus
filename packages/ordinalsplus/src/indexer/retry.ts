/**
 * Retry and circuit breaker utilities for the Ordinals Indexer
 */

import { CircuitBreakerOpenError, IndexerIntegrationError } from './errors';

// Circuit breaker state (global state across all instances)
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: number;
  status: 'closed' | 'open' | 'half-open';
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenMaxAttempts: number;
}

const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenMaxAttempts: 3
};

// Map of circuit breaker services
const circuitBreakerStates = new Map<string, CircuitBreakerState>();

/**
 * Circuit breaker implementation to prevent cascading failures
 */
export class CircuitBreaker {
  private state: CircuitBreakerState;
  private options: CircuitBreakerOptions;
  private halfOpenAttempts: number = 0;
  private readonly serviceKey: string;
  
  /**
   * Creates a new circuit breaker
   * 
   * @param serviceKey - Unique identifier for the service/endpoint
   * @param options - Circuit breaker configuration
   */
  constructor(serviceKey: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.serviceKey = serviceKey;
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
    
    // Initialize or retrieve existing circuit breaker state
    if (!circuitBreakerStates.has(serviceKey)) {
      circuitBreakerStates.set(serviceKey, {
        failureCount: 0,
        lastFailureTime: 0,
        status: 'closed'
      });
    }
    
    this.state = circuitBreakerStates.get(serviceKey)!;
  }
  
  /**
   * Executes a function with circuit breaker protection
   * 
   * @param fn - The function to execute
   * @returns The result of the function
   * @throws CircuitBreakerOpenError if the circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateState();
    
    if (this.state.status === 'open') {
      throw new CircuitBreakerOpenError(
        `Circuit breaker for ${this.serviceKey} is open`,
        { context: { serviceKey: this.serviceKey, resetAfter: this.getResetTime() } }
      );
    }
    
    try {
      const result = await fn();
      
      // Success in half-open state - close the circuit
      if (this.state.status === 'half-open') {
        this.state.status = 'closed';
        this.state.failureCount = 0;
        this.halfOpenAttempts = 0;
      }
      
      return result;
    } catch (error) {
      await this.handleFailure(error as Error);
      throw error;
    }
  }
  
  /**
   * Handles a failure and updates the circuit breaker state
   */
  private async handleFailure(error: Error): Promise<void> {
    // If the error is not transient, don't count it toward circuit breaker
    if (error instanceof IndexerIntegrationError && !error.isTransient) {
      return;
    }
    
    this.state.failureCount++;
    this.state.lastFailureTime = Date.now();
    
    // In half-open state, we're more strict
    if (this.state.status === 'half-open') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.options.halfOpenMaxAttempts) {
        this.state.status = 'open';
      }
      return;
    }
    
    // Check if we've reached the threshold for opening the circuit
    if (this.state.failureCount >= this.options.failureThreshold) {
      this.state.status = 'open';
    }
  }
  
  /**
   * Updates the circuit breaker state based on timing
   */
  private updateState(): void {
    // If circuit is open and reset timeout has passed, move to half-open
    if (
      this.state.status === 'open' && 
      Date.now() - this.state.lastFailureTime > this.options.resetTimeout
    ) {
      this.state.status = 'half-open';
      this.halfOpenAttempts = 0;
    }
  }
  
  /**
   * Gets the time when the circuit breaker will reset to half-open
   */
  private getResetTime(): number {
    if (this.state.status !== 'open') {
      return 0;
    }
    
    const elapsed = Date.now() - this.state.lastFailureTime;
    const remaining = Math.max(0, this.options.resetTimeout - elapsed);
    
    return remaining;
  }
  
  /**
   * Gets the current circuit breaker status
   */
  get status(): string {
    this.updateState();
    return this.state.status;
  }
  
  /**
   * Gets the current failure count
   */
  get failureCount(): number {
    return this.state.failureCount;
  }
  
  /**
   * Manually resets the circuit breaker to closed state
   */
  reset(): void {
    this.state.status = 'closed';
    this.state.failureCount = 0;
    this.halfOpenAttempts = 0;
  }
}

/**
 * Options for retry logic
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** Base delay in milliseconds between retries */
  baseDelay: number;
  
  /** Maximum delay in milliseconds between retries */
  maxDelay: number;
  
  /** Backoff factor for retry delay */
  backoffFactor: number;
  
  /** Random jitter factor (0-1) to add to delay */
  jitterFactor: number;
  
  /** Custom function to determine if an error is retriable */
  isRetriable?: (error: Error) => boolean;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 500,    // 500ms initial delay
  maxDelay: 30000,   // 30 seconds maximum delay
  backoffFactor: 2,  // exponential backoff
  jitterFactor: 0.1  // 10% jitter
};

/**
 * Executes a function with retry logic
 * 
 * @param fn - The function to retry
 * @param options - Retry configuration
 * @returns The result of the function
 * @throws The last error if all retries fail
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const fullOptions: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  
  let lastError: Error | undefined;
  let attempt = 0;
  
  while (attempt <= fullOptions.maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we've reached the max retries
      if (attempt >= fullOptions.maxRetries) {
        break;
      }
      
      // Check if the error is retriable
      const isRetriable = fullOptions.isRetriable
        ? fullOptions.isRetriable(lastError)
        : (lastError instanceof IndexerIntegrationError && lastError.isTransient);
      
      if (!isRetriable) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = calculateBackoffDelay(
        attempt,
        fullOptions.baseDelay,
        fullOptions.maxDelay,
        fullOptions.backoffFactor,
        fullOptions.jitterFactor
      );
      
      // Wait before the next attempt
      await sleep(delay);
      
      attempt++;
    }
  }
  
  throw lastError;
}

/**
 * Combines circuit breaker and retry logic
 * 
 * @param fn - The function to execute
 * @param circuitBreaker - Circuit breaker instance
 * @param retryOptions - Retry configuration
 * @returns The result of the function
 */
export async function withCircuitBreakerAndRetry<T>(
  fn: () => Promise<T>,
  circuitBreaker: CircuitBreaker,
  retryOptions: Partial<RetryOptions> = {}
): Promise<T> {
  return withRetry(
    () => circuitBreaker.execute(fn),
    retryOptions
  );
}

/**
 * Calculates backoff delay with jitter
 */
function calculateBackoffDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitterFactor: number
): number {
  // Calculate exponential backoff
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt);
  
  // Apply jitter
  const jitter = (Math.random() * 2 - 1) * jitterFactor * exponentialDelay;
  
  // Apply jitter and cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Simple sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
} 