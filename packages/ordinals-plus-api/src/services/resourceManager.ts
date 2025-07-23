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
    
    return await this.redis.lLen(this.ORDINALS_PLUS_LIST);
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
      inscriptionNumber: parseInt(data.inscriptionNumber),
      resourceId: data.resourceId,
      ordinalsType: data.ordinalsType,
      contentType: data.contentType,
      indexedAt: parseInt(data.indexedAt),
      indexedBy: data.indexedBy,
      network: data.network
    };
  }

  /**
   * Get Ordinals Plus inscriptions with complete resource data in reverse order (newest first)
   */
  async getOrdinalsWithData(start: number = 0, end: number = -1): Promise<any[]> {
    if (!this.connected) await this.connect();
    
    // Get total count first
    const totalCount = await this.getOrdinalsCount();
    if (totalCount === 0) return [];
    
    // For reverse order (newest first), we want to read from the beginning of the list
    // since lPush adds newest items to the front (index 0)
    const actualStart = start;
    const actualEnd = end === -1 ? start + 49 : end; // Default limit if end is -1
    
    // Get resource IDs in reverse order (newest first is already at front of list)
    const resourceIds = await this.redis.lRange(
      this.ORDINALS_PLUS_LIST, 
      actualStart, 
      actualEnd
    );
    
    // Get detailed information from stored hashes
    const resources = await Promise.all(
      resourceIds.map(async (resourceId) => {
        // Instead of parsing the DID, search for the resource data directly
        const resourceData = await this.findResourceByResourceId(resourceId);
        if (resourceData) {
          return resourceData;
        }
        
        // If no stored data found, this shouldn't happen with new indexer, but fallback
        console.warn('Resource data not found for:', resourceId);
        return {
          inscriptionId: 'unknown',
          inscriptionNumber: 0,
          resourceId,
          ordinalsType: 'unknown',
          contentType: 'unknown',
          indexedAt: Date.now(),
          indexedBy: 'fallback',
          network: resourceId.includes(':sig:') ? 'signet' : 'mainnet'
        };
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
          inscriptionNumber: parseInt(resourceData.inscriptionNumber) || 0,
          resourceId: resourceData.resourceId,
          ordinalsType: resourceData.ordinalsType,
          contentType: resourceData.contentType,
          indexedAt: parseInt(resourceData.indexedAt) || Date.now(),
          indexedBy: resourceData.indexedBy || 'indexer',
          network: resourceData.network || 'unknown'
        };
      }
    }
    
    return null;
  }

  /**
   * Get current stats
   */
  async getStats(): Promise<{ totalProcessed: number; ordinalsFound: number; errors: number; lastUpdated: number } | null> {
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
        lastUpdated: Date.now() // Use current time as we don't store this separately
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return null;
    }
  }
}

// Export singleton instance
export const resourceManager = new ResourceManagerService(); 