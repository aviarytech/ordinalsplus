/**
 * Types for the caching system
 */

/**
 * Options for cache operations
 */
export interface CacheOptions {
  /**
   * Time-to-live in milliseconds (0 means no expiration)
   */
  ttl?: number;
  
  /**
   * Tags for categorizing cache entries for group operations
   */
  tags?: string[];
}

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T> {
  /**
   * The stored value
   */
  value: T;
  
  /**
   * Expiration timestamp in milliseconds since epoch
   * (0 means no expiration)
   */
  expiresAt: number;
  
  /**
   * Time when the entry was created
   */
  createdAt: number;
  
  /**
   * Time when the entry was last accessed
   */
  lastAccessedAt: number;
  
  /**
   * Number of times the entry has been accessed
   */
  accessCount: number;
  
  /**
   * Optional tags for categorizing the entry
   */
  tags?: string[];
}

/**
 * Cache metrics for monitoring
 */
export interface CacheMetrics {
  /**
   * Number of items currently in the cache
   */
  size: number;
  
  /**
   * Number of successful cache hits
   */
  hits: number;
  
  /**
   * Number of cache misses
   */
  misses: number;
  
  /**
   * Hit ratio (hits / (hits + misses))
   */
  hitRatio: number;
  
  /**
   * Number of expired items encountered
   */
  expirations: number;
  
  /**
   * Number of items evicted due to capacity constraints
   */
  evictions: number;
  
  /**
   * Average time items spend in the cache (ms)
   */
  averageItemAge?: number;
  
  /**
   * Time of the most recent operation
   */
  lastOperationTime: number;
  
  /**
   * Breakdown of operations by type
   */
  operations: {
    get: number;
    set: number;
    delete: number;
    clear: number;
  };
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Default TTL for cache entries in milliseconds
   * (0 means no expiration)
   */
  ttl?: number;
  
  /**
   * Whether to collect metrics
   */
  collectMetrics?: boolean;
  
  /**
   * Maximum number of items to store
   * (0 means unlimited)
   */
  maxItems?: number;
}

/**
 * Cache warmer function type
 */
export type CacheWarmer = () => Promise<void>;

/**
 * Base interface for all cache implementations
 */
export interface Cache {
  /**
   * Get an item from the cache
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Set an item in the cache
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;
  
  /**
   * Check if an item exists in the cache
   */
  has(key: string): Promise<boolean>;
  
  /**
   * Delete an item from the cache
   */
  delete(key: string): Promise<boolean>;
  
  /**
   * Clear all items from the cache
   */
  clear(): Promise<void>;
  
  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics | null;
  
  /**
   * Optional cleanup method to remove expired items
   */
  cleanup?(): void;
  
  /**
   * Optional method to gracefully shutdown the cache
   */
  shutdown?(): Promise<void>;
  
  /**
   * Optional method to delete items by tag
   */
  deleteByTag?(tag: string): Promise<number>;
  
  /**
   * Optional method to get keys that match a pattern
   */
  getKeys?(pattern?: string): Promise<string[]>;
} 