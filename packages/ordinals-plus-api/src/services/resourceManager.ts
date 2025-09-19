import { createClient } from 'redis';
import type { RedisClientType } from 'redis';

/**
 * ResourceManager service for the API to access indexer data
 * Updated to work with the actual Redis structure used by the indexer
 */
class ResourceManagerService {
  private redis: RedisClientType;
  private connected: boolean = false;

  // Redis key constants - must match indexer
  private readonly ORDINALS_PLUS_LIST = 'ordinals-plus-resources';
  private readonly NON_ORDINALS_LIST = 'non-ordinals-resources';
  private readonly PROGRESS_KEY = 'indexer:cursor';
  private readonly STATS_KEY = 'ordinals-plus:stats';

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
    
    return await this.redis.sCard(this.ORDINALS_PLUS_LIST);
  }

  /**
   * Get complete resource data for an inscription from stored hash
   */
  async getResourceData(inscriptionId: string): Promise<any | null> {
    if (!this.connected) await this.connect();
    
    const resourceKey = `ordinals_plus:resource:${inscriptionId}`;
    const data = await this.redis.hGetAll(resourceKey);
    
    if (!data.inscriptionId) return null;
    
    return {
      inscriptionId: data.inscriptionId,
      inscriptionNumber: parseInt(data.inscriptionNumber || '0'),
      resourceId: data.resourceId,
      ordinalsType: data.ordinalsType,
      contentType: data.contentType,
      indexedAt: parseInt(data.indexedAt || '0'),
      indexedBy: data.indexedBy,
      network: data.network,
      // Optional mined data (if stored by indexer)
      blockHeight: data.blockHeight ? parseInt(data.blockHeight) : undefined,
      blockTimestamp: data.blockTimestamp ? parseInt(data.blockTimestamp) : undefined
    };
  }

  /**
   * Get Ordinals Plus inscriptions with complete resource data.
   * Direction controls chronological order based on list indexing (newest at index 0).
   *
   * @param offset - page offset (0-based)
   * @param limit - number of items to return
   * @param direction - 'desc' (newest first) or 'asc' (oldest first)
   */
  async getOrdinalsWithData(offset: number = 0, limit: number = 50, direction: 'desc' | 'asc' = 'desc'): Promise<any[]> {
    if (!this.connected) await this.connect();
    
    // Get total count first
    const totalCount = await this.getOrdinalsCount();
    if (totalCount === 0) return [];

    // Compute lRange indices based on direction
    let startIndex: number;
    let endIndex: number;
    if (direction === 'desc') {
      // Newest first — head of list
      startIndex = Math.max(0, offset);
      endIndex = Math.min(totalCount - 1, offset + limit - 1);
    } else {
      // Oldest first — tail of list
      // Convert offset from tail perspective
      // Example: offset 0 => oldest (index totalCount-1)
      const tailStart = Math.max(0, totalCount - offset - limit);
      const tailEnd = Math.min(totalCount - 1, totalCount - offset - 1);
      startIndex = tailStart;
      endIndex = tailEnd;
    }

    // Source is a set; collect all and page in-memory
    const allIds = await this.redis.sMembers(this.ORDINALS_PLUS_LIST);
    // Sets are unordered; sort by indexedAt via resource data for stable pagination
    const allWithData = await Promise.all(
      allIds.map(async (resourceId) => ({
        resourceId,
        data: await this.findResourceByResourceId(resourceId)
      }))
    );
    const filtered = allWithData.filter(x => x.data);
    filtered.sort((a, b) => {
      const ai = a.data!.indexedAt || 0;
      const bi = b.data!.indexedAt || 0;
      return direction === 'asc' ? ai - bi : bi - ai;
    });
    const resourceIds = filtered.slice(startIndex, endIndex + 1).map(x => x.resourceId);
    
    // Get detailed information from stored hashes
    const resources = await Promise.all(
      resourceIds.map(async (resourceId) => {
        // Instead of parsing the DID, search for the resource data directly
        const resourceData = await this.findResourceByResourceId(resourceId);
        if (resourceData) {
          return resourceData;
        }
      })
    );
    
    return resources.filter(Boolean); // Remove any null results
  }

  /**
   * Find resource data by searching for a matching resourceId
   */
  private async findResourceByResourceId(targetResourceId: string): Promise<any | null> {
    // Search through stored resource hashes
    // Pattern: ordinals_plus:resource:{inscriptionId}
    const keys = await this.redis.keys('ordinals_plus:resource:*');
    
    for (const key of keys) {
      const resourceData = await this.redis.hGetAll(key);
      if (resourceData.resourceId === targetResourceId) {
        // Convert numeric fields back to proper types
        return {
          inscriptionId: resourceData.inscriptionId,
          inscriptionNumber: parseInt(resourceData.inscriptionNumber || '0') || 0,
          resourceId: resourceData.resourceId,
          ordinalsType: resourceData.ordinalsType,
          contentType: resourceData.contentType,
          indexedAt: parseInt(resourceData.indexedAt || '0') || Date.now(),
          indexedBy: resourceData.indexedBy || 'indexer',
          network: resourceData.network || 'unknown',
          blockHeight: resourceData.blockHeight ? parseInt(resourceData.blockHeight) : undefined,
          blockTimestamp: resourceData.blockTimestamp ? parseInt(resourceData.blockTimestamp) : undefined
        };
      }
    }
    
    return null;
  }

  /**
   * Get current stats
   */
  async getStats(): Promise<{ totalProcessed: number; ordinalsFound: number; errors: number; lastUpdated: number; cursor?: number } | null> {
    if (!this.connected) await this.connect();
    
    try {
      const [
        totalOrdinals,
        totalNonOrdinals,
        cursor,
        errorCount
      ] = await Promise.all([
        this.redis.get('ordinals-plus:stats:total'),
        this.redis.get('non-ordinals:stats:total'),
        this.redis.get('indexer:cursor'),
        this.redis.get('indexer:stats:errors')
      ]);
      
      const ordinalsCount = parseInt(totalOrdinals || '0');
      const nonOrdinalsCount = parseInt(totalNonOrdinals || '0');
      const totalProcessed = ordinalsCount + nonOrdinalsCount;
      
      return {
        totalProcessed,
        ordinalsFound: ordinalsCount,
        errors: parseInt(errorCount || '0'),
        lastUpdated: Date.now(),
        cursor: parseInt(cursor || '0')
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const resourceManager = new ResourceManagerService(); 