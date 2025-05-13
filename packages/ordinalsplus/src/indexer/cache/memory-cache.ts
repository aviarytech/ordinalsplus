/**
 * In-memory cache implementation with TTL support and metrics
 */

import { Cache, CacheConfig, CacheEntry, CacheMetrics, CacheOptions } from './types';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: CacheConfig = {
  ttl: 0, // No expiration by default
  collectMetrics: true,
  maxItems: 1000
};

/**
 * In-memory cache implementation with TTL support and metrics
 */
export class MemoryCache implements Cache {
  private store: Map<string, CacheEntry<any>> = new Map();
  private config: CacheConfig;
  private metrics: CacheMetrics = {
    size: 0,
    hits: 0,
    misses: 0,
    hitRatio: 0,
    expirations: 0,
    evictions: 0,
    lastOperationTime: Date.now(),
    operations: {
      get: 0,
      set: 0,
      delete: 0,
      clear: 0
    }
  };
  
  /**
   * Create a new in-memory cache instance
   */
  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * Get an item from the cache
   */
  async get<T>(key: string): Promise<T | null> {
    this.updateMetric('get');
    
    const entry = this.store.get(key);
    
    // Cache miss
    if (!entry) {
      this.recordMiss();
      return null;
    }
    
    // Check expiration
    if (this.isExpired(entry)) {
      this.store.delete(key);
      this.recordMiss();
      this.metrics.expirations++;
      return null;
    }
    
    // Update access metadata
    entry.lastAccessedAt = Date.now();
    entry.accessCount++;
    
    // Record cache hit
    this.recordHit();
    
    return entry.value as T;
  }
  
  /**
   * Set an item in the cache
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    this.updateMetric('set');
    
    // Check max items limit before adding
    if (this.config.maxItems && this.config.maxItems > 0 && 
        !this.store.has(key) && this.store.size >= this.config.maxItems) {
      this.evictOldest();
    }
    
    // Calculate expiration time
    const ttl = options?.ttl ?? this.config.ttl ?? 0;
    const expiresAt = ttl > 0 ? Date.now() + ttl : 0;
    
    // Create cache entry
    const entry: CacheEntry<T> = {
      value,
      expiresAt,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      accessCount: 0,
      tags: options?.tags
    };
    
    // Store the entry
    this.store.set(key, entry);
    this.metrics.size = this.store.size;
  }
  
  /**
   * Check if an item exists in the cache
   */
  async has(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    
    // If entry doesn't exist, return false
    if (!entry) {
      return false;
    }
    
    // If entry is expired, delete it and return false
    if (this.isExpired(entry)) {
      this.store.delete(key);
      this.metrics.expirations++;
      this.metrics.size = this.store.size;
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete an item from the cache
   */
  async delete(key: string): Promise<boolean> {
    this.updateMetric('delete');
    
    const result = this.store.delete(key);
    this.metrics.size = this.store.size;
    return result;
  }
  
  /**
   * Clear all items from the cache
   */
  async clear(): Promise<void> {
    this.updateMetric('clear');
    
    this.store.clear();
    this.metrics.size = 0;
  }
  
  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics | null {
    if (!this.config.collectMetrics) {
      return null;
    }
    
    // Calculate current hit ratio
    const totalOps = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRatio = totalOps > 0 ? this.metrics.hits / totalOps : 0;
    
    // Calculate average item age if there are items in the cache
    if (this.store.size > 0) {
      const now = Date.now();
      let totalAge = 0;
      
      for (const entry of this.store.values()) {
        totalAge += now - entry.createdAt;
      }
      
      this.metrics.averageItemAge = totalAge / this.store.size;
    } else {
      this.metrics.averageItemAge = 0;
    }
    
    return { ...this.metrics };
  }
  
  /**
   * Clean up expired items
   */
  cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt > 0 && entry.expiresAt <= now) {
        this.store.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      this.metrics.expirations += expiredCount;
      this.metrics.size = this.store.size;
    }
  }
  
  /**
   * Delete items by tag
   */
  async deleteByTag(tag: string): Promise<number> {
    let deletedCount = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        this.store.delete(key);
        deletedCount++;
      }
    }
    
    if (deletedCount > 0) {
      this.metrics.size = this.store.size;
    }
    
    return deletedCount;
  }
  
  /**
   * Get all cache keys, optionally filtered by a pattern
   */
  async getKeys(pattern?: string): Promise<string[]> {
    if (!pattern) {
      return Array.from(this.store.keys());
    }
    
    const regex = new RegExp(pattern);
    return Array.from(this.store.keys()).filter(key => regex.test(key));
  }
  
  /**
   * Gracefully shutdown the cache
   */
  async shutdown(): Promise<void> {
    // For memory cache, this just clears the data
    this.store.clear();
    this.metrics.size = 0;
  }
  
  /**
   * Check if a cache entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return entry.expiresAt > 0 && entry.expiresAt <= Date.now();
  }
  
  /**
   * Update operation metrics
   */
  private updateMetric(operation: keyof CacheMetrics['operations']): void {
    if (this.config.collectMetrics) {
      this.metrics.operations[operation]++;
      this.metrics.lastOperationTime = Date.now();
    }
  }
  
  /**
   * Record a cache hit in metrics
   */
  private recordHit(): void {
    if (this.config.collectMetrics) {
      this.metrics.hits++;
    }
  }
  
  /**
   * Record a cache miss in metrics
   */
  private recordMiss(): void {
    if (this.config.collectMetrics) {
      this.metrics.misses++;
    }
  }
  
  /**
   * Evict the oldest or least recently used item
   */
  private evictOldest(): void {
    if (this.store.size === 0) return;
    
    // Find the oldest or least accessed entry
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.store.entries()) {
      // Prefer least accessed items, then oldest
      const score = entry.accessCount * 10000 + entry.lastAccessedAt;
      if (score < oldestTime) {
        oldestKey = key;
        oldestTime = score;
      }
    }
    
    // Evict the selected entry
    if (oldestKey) {
      this.store.delete(oldestKey);
      this.metrics.evictions++;
    }
  }
} 