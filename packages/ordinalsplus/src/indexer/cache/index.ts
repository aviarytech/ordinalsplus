/**
 * Caching system for the Ordinals Indexer
 * 
 * Provides a unified interface for caching operations with support for:
 * - Multiple cache backends (memory, Redis)
 * - TTL-based expiration
 * - Cache metrics and monitoring
 * - Cache warming and invalidation strategies
 */

export * from './types';
export * from './memory-cache';
export * from '../cache-manager'; 