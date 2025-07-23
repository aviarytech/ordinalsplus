/**
 * Cache Manager for Ordinals Indexer
 * 
 * Provides a unified interface for caching operations with support for:
 * - Multiple cache backends (memory, Redis)
 * - TTL-based expiration
 * - Cache metrics and monitoring
 * - Cache warming and invalidation strategies
 */

import { Logger, LogLevel } from './logger';
import { Cache, CacheMetrics, CacheOptions, CacheWarmer } from './cache/types';
import { MemoryCache } from './cache/memory-cache';

/**
 * CacheManager configuration
 */
export interface CacheManagerConfig {
  /**
   * Default TTL for cache entries in milliseconds
   * Set to 0 for no expiration
   */
  defaultTTL?: number;
  
  /**
   * Whether to collect cache metrics
   */
  collectMetrics?: boolean;
  
  /**
   * Log level for cache operations
   */
  logLevel?: LogLevel;
  
  /**
   * Cache cleanup interval in milliseconds
   * (how often to check for and remove expired items)
   */
  cleanupInterval?: number;
  
  /**
   * Maximum number of items to store in memory cache
   */
  maxItems?: number;
  
  /**
   * Optional Redis connection configuration
   */
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: CacheManagerConfig = {
  defaultTTL: 3600000, // 1 hour
  collectMetrics: true,
  logLevel: LogLevel.INFO,
  cleanupInterval: 300000, // 5 minutes
  maxItems: 10000
};

/**
 * CacheManager class provides a centralized way to manage different cache backends
 */
export class CacheManager {
  private config: CacheManagerConfig;
  private logger: Logger;
  private caches: Map<string, Cache> = new Map();
  private metrics: Map<string, CacheMetrics> = new Map();
  private cleanupInterval?: NodeJS.Timer;
  private warmers: Map<string, CacheWarmer> = new Map();
  
  /**
   * Creates a new CacheManager instance
   */
  constructor(config: Partial<CacheManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new Logger({ 
      prefix: 'CacheManager',
      level: this.config.logLevel
    });
    
    // Initialize default memory cache
    this.registerCache('memory', new MemoryCache({
      ttl: this.config.defaultTTL,
      maxItems: this.config.maxItems,
      collectMetrics: this.config.collectMetrics
    }));
    
    // Set up Redis cache if configured
    if (this.config.redis) {
      // Redis implementation will be added later
      this.logger.info('Redis cache configuration detected, but implementation is not yet available');
    }
    
    // Start cleanup interval if TTL is enabled
    if (this.config.defaultTTL && this.config.defaultTTL > 0 && this.config.cleanupInterval) {
      this.startCleanupInterval();
    }
    
    this.logger.info('CacheManager initialized', {
      defaultTTL: this.config.defaultTTL,
      collectMetrics: this.config.collectMetrics,
      cleanupInterval: this.config.cleanupInterval
    });
  }
  
  /**
   * Register a cache instance with a name
   */
  registerCache(name: string, cache: Cache): void {
    this.caches.set(name, cache);
    this.logger.debug(`Registered cache: ${name}`);
  }
  
  /**
   * Get a cache instance by name
   */
  getCache(name: string): Cache | undefined {
    return this.caches.get(name);
  }
  
  /**
   * Get the default memory cache
   */
  getMemoryCache(): Cache {
    return this.caches.get('memory') as Cache;
  }
  
  /**
   * Get an item from the specified cache or default memory cache
   */
  async get<T>(key: string, cacheName = 'memory'): Promise<T | null> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      this.logger.warn(`Attempted to get from non-existent cache: ${cacheName}`);
      return null;
    }
    return cache.get<T>(key);
  }
  
  /**
   * Set an item in the specified cache or default memory cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions, cacheName = 'memory'): Promise<void> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      this.logger.warn(`Attempted to set in non-existent cache: ${cacheName}`);
      return;
    }
    return cache.set(key, value, options);
  }
  
  /**
   * Check if an item exists in the specified cache
   */
  async has(key: string, cacheName = 'memory'): Promise<boolean> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      this.logger.warn(`Attempted to check existence in non-existent cache: ${cacheName}`);
      return false;
    }
    return cache.has(key);
  }
  
  /**
   * Delete an item from the specified cache
   */
  async delete(key: string, cacheName = 'memory'): Promise<boolean> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      this.logger.warn(`Attempted to delete from non-existent cache: ${cacheName}`);
      return false;
    }
    return cache.delete(key);
  }
  
  /**
   * Clear all items from the specified cache
   */
  async clear(cacheName = 'memory'): Promise<void> {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      this.logger.warn(`Attempted to clear non-existent cache: ${cacheName}`);
      return;
    }
    return cache.clear();
  }
  
  /**
   * Get metrics for a specific cache
   */
  getMetrics(cacheName = 'memory'): CacheMetrics | null {
    const cache = this.caches.get(cacheName);
    if (!cache) {
      this.logger.warn(`Attempted to get metrics for non-existent cache: ${cacheName}`);
      return null;
    }
    return cache.getMetrics();
  }
  
  /**
   * Get metrics for all caches
   */
  getAllMetrics(): Record<string, CacheMetrics> {
    const allMetrics: Record<string, CacheMetrics> = {};
    
    for (const [name, cache] of this.caches.entries()) {
      const metrics = cache.getMetrics();
      if (metrics) {
        allMetrics[name] = metrics;
      }
    }
    
    return allMetrics;
  }
  
  /**
   * Register a cache warmer function
   */
  registerWarmer(name: string, warmer: CacheWarmer): void {
    this.warmers.set(name, warmer);
    this.logger.debug(`Registered cache warmer: ${name}`);
  }
  
  /**
   * Run a specific cache warmer
   */
  async runWarmer(name: string): Promise<void> {
    const warmer = this.warmers.get(name);
    if (!warmer) {
      this.logger.warn(`Attempted to run non-existent warmer: ${name}`);
      return;
    }
    
    this.logger.debug(`Running cache warmer: ${name}`);
    try {
      await warmer();
      this.logger.debug(`Cache warmer completed: ${name}`);
    } catch (error) {
      this.logger.error(`Error running cache warmer: ${name}`, { error });
    }
  }
  
  /**
   * Run all registered cache warmers
   */
  async warmAll(): Promise<void> {
    this.logger.info(`Warming all caches (${this.warmers.size} warmers registered)`);
    
    const promises = Array.from(this.warmers.entries()).map(async ([name, warmer]) => {
      try {
        await warmer();
        this.logger.debug(`Cache warmer completed: ${name}`);
      } catch (error) {
        this.logger.error(`Error running cache warmer: ${name}`, { error });
      }
    });
    
    await Promise.all(promises);
    this.logger.info('All cache warmers completed');
  }
  
  /**
   * Start the cleanup interval to remove expired items
   */
  private startCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.logger.debug('Running cache cleanup');
      
      for (const [name, cache] of this.caches.entries()) {
        if (typeof cache.cleanup === 'function') {
          try {
            cache.cleanup();
            this.logger.debug(`Cleanup completed for cache: ${name}`);
          } catch (error) {
            this.logger.error(`Error during cleanup for cache: ${name}`, { error });
          }
        }
      }
    }, this.config.cleanupInterval);
    
    this.logger.debug(`Cleanup interval set for ${this.config.cleanupInterval}ms`);
  }
  
  /**
   * Stop the cleanup interval
   */
  stopCleanupInterval(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      this.logger.debug('Cleanup interval stopped');
    }
  }
  
  /**
   * Shutdown the cache manager and all caches
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down CacheManager');
    
    // Stop cleanup interval
    this.stopCleanupInterval();
    
    // Shutdown all caches
    for (const [name, cache] of this.caches.entries()) {
      if (typeof cache.shutdown === 'function') {
        try {
          await cache.shutdown();
          this.logger.debug(`Cache shutdown completed: ${name}`);
        } catch (error) {
          this.logger.error(`Error during shutdown for cache: ${name}`, { error });
        }
      }
    }
    
    this.logger.info('CacheManager shutdown complete');
  }
} 