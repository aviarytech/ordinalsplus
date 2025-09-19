import { OrdNodeProvider, OrdiscanProvider } from 'ordinalsplus';
import type { BitcoinNetwork } from 'ordinalsplus';
import { createClient, RedisClientType } from 'redis';

// Configuration from environment
const INDEXER_URL = process.env.INDEXER_URL as string;
if (!INDEXER_URL) {
  throw new Error('INDEXER_URL is not set');
}
const REDIS_URL = process.env.REDIS_URL as string;
if (!REDIS_URL) {
  throw new Error('REDIS_URL is not set');
}
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL ?? '5000'); // Check every 5 seconds
const BATCH_SIZE = Number(process.env.BATCH_SIZE ?? '100');
const CONCURRENT_PROCESSING = Number(process.env.CONCURRENT_PROCESSING ?? '10'); // Process inscriptions concurrently
const CACHE_TTL = Number(process.env.CACHE_TTL ?? '3600'); // 1 hour cache TTL
const START_FROM_CURRENT = process.env.START_FROM_CURRENT === 'true';
// Default to block-tail mode unless explicitly disabled
const BLOCK_TAIL_MODE = process.env.BLOCK_TAIL_MODE ? (process.env.BLOCK_TAIL_MODE === 'true') : true; // if true, use block tail watcher
const DEBUG_BLOCK = process.env.DEBUG_BLOCK ? Number(process.env.DEBUG_BLOCK) : undefined;
const REVERSE_REINDEX = process.env.REVERSE_REINDEX === 'true';
const START_BLOCK = process.env.START_BLOCK ? Number(process.env.START_BLOCK) : undefined;
const END_BLOCK = process.env.END_BLOCK ? Number(process.env.END_BLOCK) : undefined;

// Generate a unique worker ID with process ID, timestamp, and random component
const generateWorkerId = (): string => {
  const timestamp = Date.now();
  const processId = process.pid;
  const random = Math.floor(Math.random() * 10000);
  return `worker-${processId}-${timestamp}-${random}`;
};

const WORKER_ID = process.env.WORKER_ID ?? generateWorkerId();
const START_INSCRIPTION = Number(process.env.START_INSCRIPTION ?? '0');
const NETWORK = (process.env.NETWORK || 'mainnet') as BitcoinNetwork; // 'mainnet', 'signet', 'testnet'

// Provider configuration
const PROVIDER_TYPE = process.env.PROVIDER_TYPE || 'ord-node'; // 'ordiscan' or 'ord-node'
const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY || '';

// Simple failure tracking - if we get mostly 404s, we've likely reached the end
const HIGH_FAILURE_THRESHOLD = 0.8; // 80% failure rate indicates we've reached the end

interface OrdinalsResource {
  resourceId: string; // did:btco:sig:123123123/0 or did:btco:123123123/0
  inscriptionId: string;
  inscriptionNumber: number;
  ordinalsType: 'did-document' | 'verifiable-credential';
  contentType: string;
  metadata: any;
  indexedAt: number;
  blockHeight?: number;
  blockTimestamp?: number;
}

interface NonOrdinalsResource {
  resourceId: string; // did:btco:sig:123123123/0 or did:btco:123123123/0
  inscriptionId: string;
  inscriptionNumber: number;
  contentType: string;
  indexedAt: number;
}

interface BatchClaim {
  start: number;
  end: number;
  workerId: string;
  claimedAt: number;
}

interface InscriptionError {
  inscriptionId: string;
  inscriptionNumber: number;
  error: string;
  timestamp: number;
  workerId: string;
}

interface CachedSatInfo {
  inscription_ids: string[];
  cachedAt: number;
}

/**
 * Optimized analyzer for classifying resources into Ordinals Plus vs Non-Ordinals Plus
 */
class OptimizedResourceAnalyzer {
  private provider: OrdNodeProvider | OrdiscanProvider;
  private network: BitcoinNetwork;
  private satCache: Map<number, CachedSatInfo> = new Map();
  private inscriptionCache: Map<string, any> = new Map();
  private cacheCleanupInterval: NodeJS.Timeout;

  constructor(provider: OrdNodeProvider | OrdiscanProvider, network: BitcoinNetwork) {
    this.provider = provider;
    this.network = network;
    
    // Clean up cache every 5 minutes
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupCache();
    }, 5 * 60 * 1000);
  }

  private cleanupCache(): void {
    const now = Date.now();
    const maxAge = CACHE_TTL * 1000;
    
    // Clean sat cache
    for (const [sat, info] of this.satCache.entries()) {
      if (now - info.cachedAt > maxAge) {
        this.satCache.delete(sat);
      }
    }
    
    // Clean inscription cache
    for (const [id, info] of this.inscriptionCache.entries()) {
      if (now - info.cachedAt > maxAge) {
        this.inscriptionCache.delete(id);
      }
    }
  }

  async analyzeInscription(inscriptionId: string, inscriptionNumber: number, contentType: string, metadata: any, workerId: string, preloadedInscription?: any): Promise<{
    ordinalsResource: OrdinalsResource | null;
    nonOrdinalsResource: NonOrdinalsResource | null;
    error: InscriptionError | null;
  }> {
    try {
      // Generate the proper resource ID format
      const resourceId = await this.generateResourceIdOptimized(inscriptionId, inscriptionNumber, preloadedInscription);
      let ordinalsResource: OrdinalsResource | null = null;
      let nonOrdinalsResource: NonOrdinalsResource | null = null;

      // Check if this is an Ordinals Plus resource
      if (metadata && this.isOrdinalsPlus(metadata)) {
        // This is an Ordinals Plus resource
        const minedHeight = (preloadedInscription && typeof preloadedInscription.height === 'number')
          ? preloadedInscription.height
          : (preloadedInscription && typeof preloadedInscription.genesis_height === 'number'
            ? preloadedInscription.genesis_height
            : undefined);
        const minedTs = (preloadedInscription && typeof preloadedInscription.timestamp === 'number')
          ? preloadedInscription.timestamp
          : (preloadedInscription && typeof preloadedInscription.genesis_timestamp === 'number'
            ? preloadedInscription.genesis_timestamp
            : undefined);
        ordinalsResource = {
          resourceId,
          inscriptionId,
          inscriptionNumber,
          ordinalsType: this.getOrdinalsType(metadata),
          contentType: contentType || 'application/json',
          metadata,
          indexedAt: Date.now(),
          ...(typeof minedHeight === 'number' ? { blockHeight: minedHeight } : {}),
          ...(typeof minedTs === 'number' ? { blockTimestamp: minedTs } : {})
        };
      } else {
        // This is a non-Ordinals Plus resource
        nonOrdinalsResource = {
          resourceId,
          inscriptionId,
          inscriptionNumber,
          contentType: contentType || 'unknown',
          indexedAt: Date.now()
        };
      }

      return { ordinalsResource, nonOrdinalsResource, error: null };
    } catch (error) {
      // Store inscription that failed processing
      const inscriptionError: InscriptionError = {
        inscriptionId,
        inscriptionNumber,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        workerId
      };

      console.warn(`⚠️ Failed to analyze inscription ${inscriptionNumber} (${inscriptionId}): ${inscriptionError.error}`);
      return { ordinalsResource: null, nonOrdinalsResource: null, error: inscriptionError };
    }
  }

  private isOrdinalsPlus(metadata: any): boolean {
    if (!metadata) return false;
    
    // Check for DID documents
    if (metadata?.id?.startsWith('did:btco:') && metadata.verificationMethod) {
      return true;
    }
    
    // Check for Verifiable Credentials
    if (metadata?.type?.includes?.('VerifiableCredential') || metadata?.credentialSubject) {
      return true;
    }
    
    return false;
  }

  private getOrdinalsType(metadata: any): 'did-document' | 'verifiable-credential' {
    if (metadata?.id?.startsWith('did:btco:') && metadata.verificationMethod) {
      return 'did-document';
    }
    return 'verifiable-credential';
  }

  private async generateResourceIdOptimized(inscriptionId: string, inscriptionNumber: number, preloadedInscription?: any): Promise<string> {
    try {
      // Check cache first for inscription details
      let inscriptionDetails = preloadedInscription || this.inscriptionCache.get(inscriptionId);
      if (!inscriptionDetails) {
        inscriptionDetails = await this.provider.getInscription(inscriptionId);
        this.inscriptionCache.set(inscriptionId, {
          ...inscriptionDetails,
          cachedAt: Date.now()
        });
      } else if (preloadedInscription) {
        // Warm the cache with the supplied details
        this.inscriptionCache.set(inscriptionId, {
          ...preloadedInscription,
          cachedAt: Date.now()
        });
      }
      
      if (!inscriptionDetails || typeof inscriptionDetails.sat !== 'number') {
        throw new Error(`Inscription details missing or invalid sat number: ${JSON.stringify(inscriptionDetails)}`);
      }
      
      const satNumber = inscriptionDetails.sat;
      
      // Check cache first for sat info
      let satInfo = this.satCache.get(satNumber);
      if (!satInfo) {
        const freshSatInfo = await this.provider.getSatInfo(satNumber.toString());
        satInfo = {
          inscription_ids: freshSatInfo.inscription_ids,
          cachedAt: Date.now()
        };
        this.satCache.set(satNumber, satInfo);
      }
      
      if (!satInfo || !Array.isArray(satInfo.inscription_ids)) {
        throw new Error(`Sat info missing or invalid inscription_ids: ${JSON.stringify(satInfo)}`);
      }
      
      const inscriptionsOnSat = satInfo.inscription_ids;
      
      // Find the index of our inscription on this satoshi
      const inscriptionIndex = inscriptionsOnSat.indexOf(inscriptionId);
      
      if (inscriptionIndex === -1) {
        console.warn(`Warning: Inscription ${inscriptionId} not found in sat ${satNumber} inscription list. Using index 0.`);
        return this.formatDid(satNumber, 0);
      }
      
      return this.formatDid(satNumber, inscriptionIndex);
    } catch (error) {
      // Re-throw with more context for error tracking
      throw new Error(`Error generating resource ID for inscription ${inscriptionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private formatDid(satNumber: number, index: number): string {
    const networkPrefix = this.network === 'signet' ? 'sig:' : this.network === 'testnet' ? 'test:' : '';
    return `did:btco:${networkPrefix}${satNumber}/${index}`;
  }

  destroy(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
  }
}

/**
 * Simple cursor-based storage manager
 */
class ResourceStorage {
  private client: RedisClientType;
  private connected = false;

  constructor(redisUrl: string) {
    this.client = createClient({ url: redisUrl });
    this.setupHandlers();
  }

  private setupHandlers() {
    this.client.on('error', (err: any) => console.error('Redis error:', err));
    this.client.on('connect', () => {
      this.connected = true;
      console.log('✅ Connected to Redis');
    });
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.client.connect();
      
      // Initialize cursor if it doesn't exist
      const exists = await this.client.exists('indexer:cursor');
      if (!exists) {
        await this.client.set('indexer:cursor', START_INSCRIPTION.toString());
        console.log(`📍 Initialized cursor at inscription ${START_INSCRIPTION}`);
      }
      
      // Migrate any old claims to the new format
      await this.migrateOldClaims();
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.disconnect();
    }
  }

  // Simple cursor-based batch claiming
  async claimNextBatch(batchSize: number, workerId: string): Promise<BatchClaim | null> {
    // Use Lua script for atomic operation to prevent race conditions
    const luaScript = `
      local cursor = redis.call('GET', 'indexer:cursor')
      local batchSize = tonumber(ARGV[2])
      local workerId = ARGV[3]
      
      -- Find the next available batch starting from cursor + 1
      local start = tonumber(cursor or ARGV[1]) + 1
      local maxAttempts = 10 -- Prevent infinite loops
      local attempts = 0
      
      while attempts < maxAttempts do
        local endInscription = start + batchSize - 1
        local hasOverlap = false
        
        -- Check if this batch is already claimed by checking for existing claims
        local existingClaims = redis.call('KEYS', 'indexer:claim:*')
        for _, claimKey in ipairs(existingClaims) do
          local claimData = redis.call('GET', claimKey)
          if claimData then
            local claim = cjson.decode(claimData)
            -- Check for overlap with existing claims (only use endInscription field)
            if claim.endInscription and (start <= claim.endInscription and endInscription >= claim.start) then
              hasOverlap = true
              break
            end
          end
        end
        
        if not hasOverlap then
          -- Found an available batch, create the claim
          local claim = {
            start = start,
            endInscription = endInscription,
            workerId = workerId,
            claimedAt = redis.call('TIME')[1]
          }
          
          -- Store the claim
          redis.call('SET', 'indexer:claim:' .. workerId, cjson.encode(claim), 'EX', 3600)
          
          -- Return the claim data
          return cjson.encode(claim)
        end
        
        -- Try the next batch
        start = endInscription + 1
        attempts = attempts + 1
      end
      
      -- No available batch found
      return nil
    `;

    try {
      const result = await this.client.eval(luaScript, {
        keys: [],
        arguments: [START_INSCRIPTION.toString(), batchSize.toString(), workerId]
      });

      if (result === null) {
        return null; // No batch available
      }

      const claimData = JSON.parse(result as string);
      // Convert the Lua field name back to the expected interface
      const claim: BatchClaim = {
        start: claimData.start,
        end: claimData.endInscription,
        workerId: claimData.workerId,
        claimedAt: claimData.claimedAt
      };
      return claim;
    } catch (error) {
      console.error('Error claiming batch:', error);
      return null;
    }
  }

  async completeBatch(endNumber: number): Promise<void> {
    // Update cursor to the highest completed inscription
    await this.client.set('indexer:cursor', endNumber.toString());
    
    // Clean up expired claims to prevent memory leaks
    await this.cleanupExpiredClaims();
  }

  private async cleanupExpiredClaims(): Promise<void> {
    try {
      const claimKeys = await this.client.keys('indexer:claim:*');
      const now = Date.now();
      
      for (const key of claimKeys) {
        const claimData = await this.client.get(key);
        if (claimData) {
          const claim: BatchClaim = JSON.parse(claimData);
          // Remove claims older than 1 hour (3600000 ms)
          if (now - claim.claimedAt > 3600000) {
            await this.client.del(key);
          }
        }
      }
    } catch (error) {
      console.warn('Error cleaning up expired claims:', error);
    }
  }

  private async migrateOldClaims(): Promise<void> {
    try {
      const claimKeys = await this.client.keys('indexer:claim:*');
      
      for (const key of claimKeys) {
        const claimData = await this.client.get(key);
        if (claimData) {
          const claim = JSON.parse(claimData);
          // If the claim has the old 'end' field but not 'endInscription', migrate it
          if (claim.end && !claim.endInscription) {
            const migratedClaim = {
              start: claim.start,
              endInscription: claim.end,
              workerId: claim.workerId,
              claimedAt: claim.claimedAt
            };
            await this.client.set(key, JSON.stringify(migratedClaim), { EX: 3600 });
            console.log(`Migrated old claim format for worker: ${claim.workerId}`);
          }
        }
      }
    } catch (error) {
      console.warn('Error migrating old claims:', error);
    }
  }

  // Resource storage methods
  async storeOrdinalsResource(resource: OrdinalsResource): Promise<void> {
    const exists = await this.client.sIsMember('indexed:inscriptions', resource.inscriptionId);
    if (exists) return;

    const resourceKey = `ordinals_plus:resource:${resource.inscriptionId}`;
    const network = this.extractNetworkFromResourceId(resource.resourceId);
    await this.client.multi()
      // use a set of resource IDs to avoid duplicates
      .sAdd('ordinals-plus-resources', resource.resourceId)
      // detailed resource hash for API lookup
      .hSet(resourceKey, {
        inscriptionId: resource.inscriptionId,
        inscriptionNumber: resource.inscriptionNumber.toString(),
        resourceId: resource.resourceId,
        ordinalsType: resource.ordinalsType,
        contentType: resource.contentType,
        indexedAt: resource.indexedAt.toString(),
        network,
        ...(typeof resource.blockHeight === 'number' ? { blockHeight: resource.blockHeight.toString() } : {}),
        ...(typeof resource.blockTimestamp === 'number' ? { blockTimestamp: resource.blockTimestamp.toString() } : {})
      })
      // dedup key
      .sAdd('indexed:inscriptions', resource.inscriptionId)
      // stats
      .incr('ordinals-plus:stats:total')
      .incr(`ordinals-plus:stats:${resource.ordinalsType}`)
      .exec();
  }

  async storeNonOrdinalsResource(resource: NonOrdinalsResource): Promise<void> {
    const exists = await this.client.sIsMember('indexed:inscriptions', resource.inscriptionId);
    if (exists) return;

    const typeKey = resource.contentType.split('/')[0] || 'unknown';
    await this.client.multi()
      .lPush('non-ordinals-resources', resource.inscriptionId)
      .sAdd('indexed:inscriptions', resource.inscriptionId)
      .incr('non-ordinals:stats:total')
      .incr(`non-ordinals:stats:${typeKey}`)
      .exec();
  }

  private extractNetworkFromResourceId(resourceId: string): string {
    // Extract network from resource ID format: did:btco:sig:123/0 or did:btco:123/0
    const match = resourceId.match(/did:btco:(?:(sig):)?/);
    return match && match[1] ? 'signet' : 'mainnet';
  }

  async storeInscriptionError(error: InscriptionError): Promise<void> {
    // Store error details as a hash
    const errorKey = `indexer:error:${error.inscriptionNumber}`;
    await this.client.hSet(errorKey, {
      inscriptionId: error.inscriptionId,
      inscriptionNumber: error.inscriptionNumber.toString(),
      error: error.error,
      timestamp: error.timestamp.toString(),
      workerId: error.workerId
    });
    
    // Add to error list for easy retrieval
    await this.client.lPush('indexer:errors', error.inscriptionId);
    
    // Update error counter
    await this.client.incr('indexer:stats:errors');
  }

  async getOrdinalsResources(limit: number = 50, offset: number = 0): Promise<string[]> {
    // Sets are unordered; fetch members and page in-memory
    const all = await this.client.sMembers('ordinals-plus-resources');
    return all.slice(offset, offset + limit);
  }

  async getNonOrdinalsResources(limit: number = 50, offset: number = 0): Promise<string[]> {
    const resourceIds = await this.client.lRange('non-ordinals-resources', offset, offset + limit - 1);
    return resourceIds;
  }

  async getInscriptionErrors(limit: number = 50, offset: number = 0): Promise<string[]> {
    const errorIds = await this.client.lRange('indexer:errors', offset, offset + limit - 1);
    return errorIds;
  }

  async getErrorDetails(inscriptionId: string): Promise<InscriptionError | null> {
    // Find the error by looking through error entries
    const errorKeys = await this.client.keys('indexer:error:*');
    for (const key of errorKeys) {
      const errorData = await this.client.hGetAll(key);
      if (errorData.inscriptionId === inscriptionId) {
        return {
          inscriptionId: errorData.inscriptionId,
          inscriptionNumber: parseInt(errorData.inscriptionNumber),
          error: errorData.error,
          timestamp: parseInt(errorData.timestamp),
          workerId: errorData.workerId
        };
      }
    }
    return null;
  }

  async getStats(): Promise<{
    ordinalsPlus: { total: number; didDocuments: number; verifiableCredentials: number };
    nonOrdinals: { total: number; [key: string]: number };
    errors: { total: number };
    cursor: number;
    activeWorkers: number;
  }> {
    const [ordinalsTotal, dids, vcs, nonOrdinalsTotal, cursor, errorTotal, activeClaims] = await Promise.all([
      this.client.get('ordinals-plus:stats:total'),
      this.client.get('ordinals-plus:stats:did-document'),
      this.client.get('ordinals-plus:stats:verifiable-credential'),
      this.client.get('non-ordinals:stats:total'),
      this.client.get('indexer:cursor'),
      this.client.get('indexer:stats:errors'),
      this.getActiveWorkerClaims()
    ]);

    // Get content type breakdown for non-ordinals
    const contentTypeKeys = await this.client.keys('non-ordinals:stats:*');
    const nonOrdinals: { total: number; [key: string]: number } = {
      total: parseInt(nonOrdinalsTotal || '0')
    };

    for (const key of contentTypeKeys) {
      if (!key.includes('total')) {
        const type = key.split(':')[2];
        const count = await this.client.get(key);
        nonOrdinals[type] = parseInt(count || '0');
      }
    }

    return {
      ordinalsPlus: {
        total: parseInt(ordinalsTotal || '0'),
        didDocuments: parseInt(dids || '0'),
        verifiableCredentials: parseInt(vcs || '0')
      },
      nonOrdinals,
      errors: {
        total: parseInt(errorTotal || '0')
      },
      cursor: parseInt(cursor || START_INSCRIPTION.toString()),
      activeWorkers: activeClaims.length
    };
  }

  async getCurrentCursor(): Promise<number> {
    const cursor = await this.client.get('indexer:cursor');
    return parseInt(cursor || START_INSCRIPTION.toString());
  }

  async releaseWorkerClaim(workerId: string): Promise<void> {
    const claimKey = `indexer:claim:${workerId}`;
    await this.client.del(claimKey);
    console.log(`🔓 Released claim for worker: ${workerId}`);
  }

  async clearAllClaims(): Promise<void> {
    try {
      const claimKeys = await this.client.keys('indexer:claim:*');
      if (claimKeys.length > 0) {
        await this.client.del(claimKeys);
        console.log(`🧹 Cleared ${claimKeys.length} outstanding worker claim(s)`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to clear outstanding worker claims:', error);
    }
  }

  async getActiveWorkerClaims(): Promise<BatchClaim[]> {
    try {
      const claimKeys = await this.client.keys('indexer:claim:*');
      const claims: BatchClaim[] = [];
      
      for (const key of claimKeys) {
        const claimData = await this.client.get(key);
        if (claimData) {
          const claim: BatchClaim = JSON.parse(claimData);
          claims.push(claim);
        }
      }
      
      return claims;
    } catch (error) {
      console.warn('Error getting active worker claims:', error);
      return [];
    }
  }

  // Added: allow external updates to the cursor
  async setCursor(value: number): Promise<void> {
    await this.client.set('indexer:cursor', value.toString());
    console.log(`📍 Cursor manually set to inscription ${value}`);
  }
}

/**
 * Simplified indexer worker
 */
class ScalableIndexerWorker {
  private provider: OrdNodeProvider | OrdiscanProvider;
  private storage: ResourceStorage;
  private analyzer: OptimizedResourceAnalyzer;
  private workerId: string;
  private running = false;
  private debugBlock: number | undefined = DEBUG_BLOCK;

  constructor() {
    // Initialize provider based on configuration
    if (PROVIDER_TYPE === 'ordiscan') {
      if (!ORDISCAN_API_KEY) {
        throw new Error('ORDISCAN_API_KEY environment variable is required when using ordiscan provider');
      }
      this.provider = new OrdiscanProvider({ 
        apiKey: ORDISCAN_API_KEY,
        network: NETWORK,
        timeout: 10000 // 10 second timeout for API calls
      }, undefined, BATCH_SIZE);
    } else {
      this.provider = new OrdNodeProvider({ 
        nodeUrl: INDEXER_URL, 
        network: NETWORK 
      }, BATCH_SIZE);
    }
    
    this.storage = new ResourceStorage(REDIS_URL);
    this.analyzer = new OptimizedResourceAnalyzer(this.provider, NETWORK);
    this.workerId = WORKER_ID;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async start(): Promise<void> {
    console.log(`🚀 Starting Resource Indexer Worker: ${this.workerId} on ${NETWORK}`);
    console.log(`📡 Using provider: ${PROVIDER_TYPE}`);
    console.log(`🏠 Provider endpoint: ${PROVIDER_TYPE === 'ordiscan' ? 'Ordiscan API' : INDEXER_URL}`);
    if (BLOCK_TAIL_MODE) {
      console.log('🌀 Block tail mode enabled (crawl last 5 blocks then watch for new).');
    }
    
    await this.storage.connect();
    this.running = true;

    // Set up graceful shutdown
    process.on('SIGINT', () => this.stop());
    process.on('SIGTERM', () => this.stop());

    // Reverse reindex mode takes precedence when enabled
    if (REVERSE_REINDEX) {
      await this.runReverseReindexLoop();
      return;
    }

    if (BLOCK_TAIL_MODE) {
      await this.runTailLoop();
      return;
    }

    // If configured to start from the current tip, compute the latest inscription number and set the cursor
    if (START_FROM_CURRENT) {
      const currentCursor = await this.storage.getCurrentCursor();
      if (currentCursor <= START_INSCRIPTION) {
        console.log('⏫ Determining latest inscription number to start from...');
        const latestNumber = await this.getLatestInscriptionNumber();
        await this.storage.setCursor(latestNumber);
        console.log(`🚀 Starting from latest inscription #${latestNumber}. Awaiting new inscriptions...`);
      }
    }

    await this.workerLoop();
  }

  async stop(): Promise<void> {
    console.log(`🛑 Stopping Worker: ${this.workerId}`);
    this.running = false;
    
    // Clean up analyzer
    this.analyzer.destroy();
    
    // Release any active claim for this worker
    await this.storage.releaseWorkerClaim(this.workerId);
    
    await this.storage.disconnect();
    process.exit(0);
  }

  private async workerLoop(): Promise<void> {
    while (this.running) {
      try {
        // Claim next batch
        const batch = await this.storage.claimNextBatch(BATCH_SIZE, this.workerId);
        if (!batch) {
          console.log(`⏰ No work available, waiting ${POLL_INTERVAL/1000}s...`);
          await this.sleep(POLL_INTERVAL);
          continue;
        }

        console.log(`📋 Worker ${this.workerId} processing batch ${batch.start}-${batch.end}`);
        
        // Process inscriptions in parallel with concurrency control
        const results = await this.processBatchParallel(batch);
        
        // Handle batch completion - check for overshoot (all misses)
        if (results.ordinalsFound === 0 && results.nonOrdinalsFound === 0 && results.failures === BATCH_SIZE) {
          // Likely started beyond chain tip – clear claims, reset cursor near actual tip, and retry later
          try {
            await this.storage.releaseWorkerClaim(this.workerId);
          } catch (e) {
            console.warn('⚠️ Failed to release worker claim before resetting cursor:', (e as any)?.message || e);
          }
          try {
            await this.storage.clearAllClaims();
          } catch (e) {
            console.warn('⚠️ Failed to clear outstanding worker claims:', (e as any)?.message || e);
          }
          let target = Math.max(0, batch.start - BATCH_SIZE);
          try {
            const latestNumber = await this.getLatestInscriptionNumber();
            if (Number.isFinite(latestNumber) && latestNumber > 0) {
              target = Math.max(0, latestNumber - 1);
            }
          } catch (e) {
            console.warn('⚠️ Could not determine latest inscription number, using backCursor heuristic');
          }
          await this.storage.setCursor(target);
          console.log(`🔄 Overshoot detected: claims cleared, cursor set to ${target}. Waiting for new data...`);
          await this.sleep(POLL_INTERVAL);
          continue; // Retry loop
        }

        // Handle batch completion - ONLY advance cursor to where we've actually processed inscriptions
        const failureRate = results.failures / BATCH_SIZE;
        if (failureRate > HIGH_FAILURE_THRESHOLD) {
          if (results.firstMissingInscription !== null) {
            // We hit missing inscriptions - only advance cursor to just before the first missing one
            const maxProcessedInscription = results.firstMissingInscription - 1;
            if (maxProcessedInscription >= batch.start) {
              await this.storage.completeBatch(maxProcessedInscription);
              console.log(`📍 Advanced cursor to ${maxProcessedInscription}, waiting for inscription #${results.firstMissingInscription} to be created`);
            } else {
              console.log(`📍 No inscriptions processed in batch ${batch.start}-${batch.end}, cursor unchanged`);
            }
          } else {
            // High failure rate but no specific missing inscription identified
            await this.storage.completeBatch(batch.end);
            console.log(`📍 High failure rate, advanced cursor to ${batch.end}`);
          }
          
          console.log(`⏰ Waiting ${POLL_INTERVAL/1000}s for new inscriptions...`);
          await this.sleep(POLL_INTERVAL);
        } else {
          // Successfully completed batch - safe to advance cursor to the end
          await this.storage.completeBatch(batch.end);
          console.log(`📊 Batch ${batch.start}-${batch.end} completed: ${results.ordinalsFound} Ordinals Plus, ${results.nonOrdinalsFound} Non-Ordinals, ${results.failures} failures`);
        }
        
        // Show overall stats
        const stats = await this.storage.getStats();
        console.log(`📈 Global stats: cursor=${stats.cursor}, ${stats.ordinalsPlus.total} Ordinals Plus, ${stats.nonOrdinals.total} Non-Ordinals, ${stats.errors.total} errors, ${stats.activeWorkers} active workers`);

      } catch (error) {
        console.error('❌ Worker error:', error);
        await this.sleep(5000); // Brief pause on error
      }
    }
  }

  private async processBatchParallel(batch: BatchClaim): Promise<{
    ordinalsFound: number;
    nonOrdinalsFound: number;
    failures: number;
    firstMissingInscription: number | null;
  }> {
    const inscriptionNumbers = Array.from(
      { length: batch.end - batch.start + 1 },
      (_, i) => batch.start + i
    );

    let ordinalsFound = 0;
    let nonOrdinalsFound = 0;
    let failures = 0;
    let firstMissingInscription: number | null = null;

    // Process inscriptions in chunks to control concurrency
    for (let i = 0; i < inscriptionNumbers.length; i += CONCURRENT_PROCESSING) {
      const chunk = inscriptionNumbers.slice(i, i + CONCURRENT_PROCESSING);
      
      // Process chunk in parallel
      const chunkPromises = chunk.map(async (inscriptionNumber) => {
        try {
          const inscription = await this.provider.getInscriptionByNumber(inscriptionNumber);
          
          if (inscription?.id) {
            // Try to get metadata
            const metadata = await this.provider.getMetadata(inscription.id);
            
            // Analyze the inscription
            const { ordinalsResource, nonOrdinalsResource, error } = await this.analyzer.analyzeInscription(
              inscription.id,
              inscriptionNumber,
              inscription.content_type || 'unknown',
              metadata,
              this.workerId,
              inscription
            );

            // Store results
            if (ordinalsResource) {
              await this.storage.storeOrdinalsResource(ordinalsResource);
              console.log(`✅ Ordinals Plus: ${ordinalsResource.resourceId} (${ordinalsResource.ordinalsType})`);
              return { type: 'ordinals' as const, resource: ordinalsResource };
            } else if (nonOrdinalsResource) {
              await this.storage.storeNonOrdinalsResource(nonOrdinalsResource);
              return { type: 'non-ordinals' as const, resource: nonOrdinalsResource };
            } else if (error) {
              await this.storage.storeInscriptionError(error);
              console.log(`❌ Error stored: ${error.inscriptionId} - ${error.error}`);
              return { type: 'error' as const, error };
            }
          } else {
            // This inscription doesn't exist yet
            return { type: 'missing' as const, inscriptionNumber };
          }

        } catch (error) {
          // This inscription doesn't exist yet
          return { type: 'missing' as const, inscriptionNumber };
        }
      });

      // Wait for chunk to complete and collect results
      const chunkResults = await Promise.all(chunkPromises);
      
      // Process results
      for (const result of chunkResults) {
        if (!result) continue; // Skip undefined results
        
        if (result.type === 'ordinals') {
          ordinalsFound++;
        } else if (result.type === 'non-ordinals') {
          nonOrdinalsFound++;
        } else if (result.type === 'error') {
          failures++;
        } else if (result.type === 'missing') {
          if (firstMissingInscription === null) {
            firstMissingInscription = result.inscriptionNumber;
          }
          failures++;
        }
      }

      // Brief pause between chunks to avoid overwhelming the API
      if (i + CONCURRENT_PROCESSING < inscriptionNumbers.length) {
        await this.sleep(100);
      }
    }

    return {
      ordinalsFound,
      nonOrdinalsFound,
      failures,
      firstMissingInscription
    };
  }

  // Added helper to discover the latest valid inscription number using exponential + binary search
  private async getLatestInscriptionNumber(): Promise<number> {
    // 1. Try quick path via latest block endpoint
    try {
      if (typeof (this.provider as any).getLatestBlock === 'function') {
        const latestBlock = await (this.provider as any).getLatestBlock();
        if (latestBlock) {
          let h = latestBlock.height;
          const backLimit = 10; // scan up to 10 blocks back
          for (let offset = 0; offset <= backLimit && h - offset >= 0; offset++) {
            const blk = offset === 0 ? latestBlock : await (this.provider as any).getBlockByHeight(h - offset);
            if (blk && blk.inscriptions && blk.inscriptions.length > 0) {
              const nums = blk.inscriptions.map((i: any) => i.number).filter((n: any) => typeof n === 'number');
              if (nums.length > 0) {
                return Math.max(...nums);
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to fetch latest block, falling back to binary search:', (e as any)?.message || e);
    }

    // 2. Fallback: exponential + binary search on inscription numbers
    let low = 0;
    let high = 1;
    while (true) {
      try {
        const ins = await this.provider.getInscriptionByNumber(high);
        if (!ins || !ins.id) throw new Error('invalid');
        low = high;
        high *= 2;
      } catch {
        break;
      }
    }
    while (low + 1 < high) {
      const mid = Math.floor((low + high) / 2);
      try {
        const ins = await this.provider.getInscriptionByNumber(mid);
        if (!ins || !ins.id) throw new Error('invalid');
        low = mid;
      } catch {
        high = mid;
      }
    }
    return low;
  }

  // Tail loop for BLOCK_TAIL_MODE
  private async runTailLoop(): Promise<void> {
    const BLOCK_LOOKBACK = Number(process.env.BLOCK_LOOKBACK ?? '5');
    let latestBlock = await (this.provider as any).getLatestBlock?.();
    if (!latestBlock || typeof latestBlock.height !== 'number') {
      console.error('❌ Provider does not support latest block endpoint – cannot run tail mode');
      this.running = false;
      return;
    }
    let currentHeight = latestBlock.height;
    let nextHeightToProcess = Math.max(0, currentHeight - BLOCK_LOOKBACK + 1);
    console.log(`⏩ Will process blocks ${nextHeightToProcess} → ${currentHeight} to catch up.`);
    while (this.running) {
      try {
        if (nextHeightToProcess > currentHeight) {
          // Wait for new blocks
          await this.sleep(POLL_INTERVAL);
          const lb = await (this.provider as any).getLatestBlock?.();
          if (lb && lb.height > currentHeight) {
            currentHeight = lb.height;
            console.log(`📦 New block detected: ${currentHeight}`);
          }
          continue;
        }
        const block = nextHeightToProcess === latestBlock.height ? latestBlock : await (this.provider as any).getBlockByHeight(nextHeightToProcess);
        await this.processBlock(block, nextHeightToProcess);
        nextHeightToProcess++;
      } catch (err) {
        console.error('❌ Tail loop error:', (err as any)?.message || err);
        await this.sleep(2000);
      }
    }
  }

  // Reverse reindex loop: walk blocks from tip (or START_BLOCK) down to END_BLOCK (or 0)
  private async runReverseReindexLoop(): Promise<void> {
    console.log('🔁 Reverse reindex mode enabled.');
    // Determine starting height
    let startHeight: number | undefined = START_BLOCK;
    let startHeightNum: number;
    if (startHeight === undefined) {
      const latestBlock = await (this.provider as any).getLatestBlock?.();
      if (!latestBlock || typeof latestBlock.height !== 'number') {
        console.error('❌ Provider does not support latest block endpoint – cannot run reverse reindex');
        this.running = false;
        return;
      }
      startHeightNum = latestBlock.height as number;
    } else {
      startHeightNum = startHeight;
    }
    const endHeightNum: number = END_BLOCK !== undefined ? END_BLOCK : 0;
    console.log(`⬇️  Reindexing blocks ${startHeightNum} → ${endHeightNum} (descending)`);
    let processed = 0;
    for (let h = startHeightNum; this.running && h >= endHeightNum; h--) {
      try {
        const block = await (this.provider as any).getBlockByHeight?.(h);
        await this.processBlock(block, h);
        processed++;
        if (processed % 100 === 0) {
          console.log(`📦 Reverse reindex progress: processed ${processed} blocks (current height ${h})`);
          // Light pacing to avoid overwhelming the provider
          await this.sleep(200);
        }
      } catch (err) {
        console.error('❌ Reverse loop error:', (err as any)?.message || err);
        await this.sleep(200);
      }
    }
    console.log('✅ Reverse reindex completed.');
    this.running = false;
  }

  private async processBlock(block: any, height: number): Promise<void> {
    let inscriptionIds: string[] = [];
    if (block && Array.isArray(block.inscriptions)) {
      if (this.debugBlock === height) {
        console.log(`[DEBUG] Raw block.inscriptions sample:`, Array.isArray(block.inscriptions) ? block.inscriptions.slice(0, 5) : block.inscriptions);
      }
      // Normalize possible shapes: [string] or [{ id, number }]
      const first = block.inscriptions[0];
      if (typeof first === 'string') {
        inscriptionIds = block.inscriptions as string[];
      } else if (first && typeof first === 'object' && typeof first.id === 'string') {
        inscriptionIds = (block.inscriptions as any[])
          .map((i: any) => i?.id)
          .filter((id: any) => typeof id === 'string');
      } else {
        // Fallback to helper if unknown shape
        inscriptionIds = await (this.provider as any).getBlockInscriptions?.(height) ?? [];
      }
      // Deduplicate just in case
      const before = inscriptionIds.length;
      inscriptionIds = Array.from(new Set(inscriptionIds));
      if (this.debugBlock === height && before !== inscriptionIds.length) {
        console.log(`[DEBUG] Deduped inscription IDs: ${before} -> ${inscriptionIds.length}`);
      }
    } else if (block && typeof block.inscriptions === 'number') {
      inscriptionIds = await (this.provider as any).getBlockInscriptions?.(height) ?? [];
    } else {
      // Try fetching via helper if object lacked array
      inscriptionIds = await (this.provider as any).getBlockInscriptions?.(height) ?? [];
    }
    if (inscriptionIds.length === 0) {
      if (this.debugBlock === height) {
        console.log(`[DEBUG] No inscriptions IDs resolved for block ${height}`);
      }
      return;
    }
    console.log(`🔍 Processing block ${height} with ${inscriptionIds.length} inscriptions`);
    if (this.debugBlock === height) {
      console.log(`[DEBUG] Resolved inscription IDs (first 5): ${inscriptionIds.slice(0, 5).join(', ')}`);
    }
    const seenInscriptionIds = new Set<string>();
    let ordinalsCount = 0;
    let nonOrdinalsCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    for (const insId of inscriptionIds) {
      if (seenInscriptionIds.has(insId)) {
        duplicateCount++;
        if (this.debugBlock === height) {
          console.log(`[DEBUG] Skipping duplicate inscription ID in block ${height}: ${insId}`);
        }
        continue;
      }
      seenInscriptionIds.add(insId);
      try {
        const inscription = await this.provider.getInscription(insId);
        const metadata = await this.provider.getMetadata(insId);
        const { ordinalsResource, nonOrdinalsResource, error } = await this.analyzer.analyzeInscription(
          insId,
          inscription.number ?? -1,
          inscription.content_type || 'unknown',
          metadata,
          this.workerId,
          inscription
        );
        // Avoid per-inscription logs to reduce noise
        if (ordinalsResource) {
          if (this.debugBlock === height) {
            console.log(`📝 [DEBUG] Storing Ordinals Plus resource in Redis:`, {
              resourceId: ordinalsResource.resourceId,
              inscriptionId: ordinalsResource.inscriptionId,
              ordinalsType: ordinalsResource.ordinalsType,
              blockHeight: ordinalsResource.blockHeight,
              blockTimestamp: ordinalsResource.blockTimestamp
            });
          }
          await this.storage.storeOrdinalsResource(ordinalsResource);
          ordinalsCount++;
        } else if (nonOrdinalsResource) {
          await this.storage.storeNonOrdinalsResource(nonOrdinalsResource);
          nonOrdinalsCount++;
        } else if (error) {
          await this.storage.storeInscriptionError(error);
          errorCount++;
        }
      } catch (e) {
        if (this.debugBlock !== height) {
          console.warn(`⚠️ Failed to process inscription in block ${height}:`, (e as any)?.message || e);
        }
        errorCount++;
      }
    }
    if (this.debugBlock === height) {
      console.log(`[DEBUG] Block ${height} summary: ordinals=${ordinalsCount}, nonOrdinals=${nonOrdinalsCount}, errors=${errorCount}, duplicatesSkipped=${duplicateCount}`);
    }
  }

  // Public: index a specific block height once and exit
  async indexBlock(height: number): Promise<void> {
    // Connect storage for read/write
    await this.storage.connect();
    try {
      console.log(`📦 [index-block] Fetching block ${height} from provider...`);
      const block = await (this.provider as any).getBlockByHeight?.(height);
      if (!block) {
        console.warn(`⚠️ [index-block] No block returned for height ${height}`);
        return;
      }
      const hasInscriptions = Array.isArray((block as any).inscriptions);
      console.log(`📦 [index-block] Block ${height} fetched. hasInscriptions=${hasInscriptions}${hasInscriptions ? ` count=${(block as any).inscriptions.length}` : ''}`);
      // Enable detailed debug for this block
      this.debugBlock = height;
      await this.processBlock(block, height);
      console.log(`✅ [index-block] Finished processing block ${height}`);
    } finally {
      // Cleanup resources
      this.analyzer.destroy();
      await this.storage.disconnect();
    }
  }
}

// Main execution
async function run(): Promise<void> {
  const worker = new ScalableIndexerWorker();
  await worker.start();
}

// Export for testing
export { ScalableIndexerWorker, ResourceStorage, OptimizedResourceAnalyzer };

// Start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(console.error);
}