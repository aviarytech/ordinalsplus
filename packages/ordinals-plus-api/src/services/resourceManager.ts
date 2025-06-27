import { createClient, RedisClientType } from 'redis';

/**
 * ResourceManager service for the API to access indexer data
 * Mirrors the ResourceManager from the indexer package
 */
class ResourceManagerService {
  private redis: RedisClientType;
  private connected: boolean = false;

  // Redis key constants - must match indexer
  private readonly ORDINALS_PLUS_SET = 'ordinals_plus:inscriptions';
  private readonly PROGRESS_KEY = 'ordinals_plus:progress';
  private readonly STATS_KEY = 'ordinals_plus:stats';

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.redis = createClient({ url: redisUrl });
    this.setupRedisHandlers();
  }

  private setupRedisHandlers(): void {
    this.redis.on('error', (err) => {
      console.error('[ResourceManagerService] Redis error:', err);
      this.connected = false;
    });

    this.redis.on('connect', () => {
      console.log('[ResourceManagerService] Connected to Redis');
      this.connected = true;
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.redis.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.redis.disconnect();
      this.connected = false;
    }
  }

  /**
   * Get count of Ordinals Plus inscriptions found
   */
  async getOrdinalsCount(): Promise<number> {
    if (!this.connected) await this.connect();
    
    return await this.redis.zCard(this.ORDINALS_PLUS_SET);
  }

  /**
   * Get complete resource data for an inscription
   */
  async getResourceData(inscriptionId: string): Promise<any | null> {
    if (!this.connected) await this.connect();
    
    const resourceKey = `ordinals_plus:resource:${inscriptionId}`;
    const data = await this.redis.hGetAll(resourceKey);
    
    if (!data.inscriptionId) return null;
    
    return {
      inscriptionId: data.inscriptionId,
      inscriptionNumber: parseInt(data.inscriptionNumber),
      resourceId: data.resourceId,
      ordinalsType: data.ordinalsType,
      contentType: data.contentType,
      indexedAt: parseInt(data.indexedAt),
      indexedBy: data.indexedBy
    };
  }

  /**
   * Get all Ordinals Plus inscriptions with complete resource data
   */
  async getOrdinalsWithData(start: number = 0, end: number = -1): Promise<any[]> {
    if (!this.connected) await this.connect();
    
    const inscriptionIds = await this.redis.zRange(this.ORDINALS_PLUS_SET, start, end);
    const resources = await Promise.all(
      inscriptionIds.map(async (inscriptionId) => {
        const resourceData = await this.getResourceData(inscriptionId);
        return resourceData || {
          inscriptionId,
          inscriptionNumber: 0,
          resourceId: inscriptionId,
          ordinalsType: 'unknown',
          contentType: 'unknown',
          indexedAt: Date.now(),
          indexedBy: 'unknown'
        };
      })
    );
    
    return resources;
  }

  /**
   * Get current stats
   */
  async getStats(): Promise<{ totalProcessed: number; ordinalsFound: number; errors: number; lastUpdated: number } | null> {
    if (!this.connected) await this.connect();
    
    const stats = await this.redis.hGetAll(this.STATS_KEY);
    if (!stats.totalProcessed) return null;
    
    return {
      totalProcessed: parseInt(stats.totalProcessed),
      ordinalsFound: parseInt(stats.ordinalsFound),
      errors: parseInt(stats.errors),
      lastUpdated: parseInt(stats.lastUpdated)
    };
  }
}

// Export singleton instance
export const resourceManager = new ResourceManagerService(); 