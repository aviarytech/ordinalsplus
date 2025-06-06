/**
 * Ordinals Indexer Client Implementation
 * 
 * Provides a client for interacting with an Ordinals indexer API, with support for
 * caching, retries, and CBOR metadata handling.
 */

import { createFetchClient, FetchRequestConfig, FetchError, FetchResponse } from '../utils/fetchUtils';
import { extractCborMetadata } from '../utils/cbor-utils';
import { 
  OrdinalsIndexerConfig, 
  IndexerInscription, 
  IndexerDatabase,
  PaginatedResponse,
  InscriptionSearchParams 
} from '../types';

import {
  ErrorHandler,
  Logger,
  LogLevel,
  DeadLetterQueue,
  MemoryDLQStorage,
  DataParsingError
} from './error-handling';

import { CacheManager } from './cache-manager';
import { MemoryCache } from './cache/memory-cache';

/**
 * Default configuration for the indexer client
 */
const DEFAULT_CONFIG: Partial<OrdinalsIndexerConfig> = {
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  cacheTTL: 3600000, // 1 hour
  enableCaching: true
};

/**
 * OrdinalsIndexer class provides methods to interact with an Ordinals indexer API
 */
export class OrdinalsIndexer {
  private client: ReturnType<typeof createFetchClient>;
  private config: OrdinalsIndexerConfig;
  private db?: IndexerDatabase;
  private logger: Logger;
  private errorHandler: ErrorHandler;
  private dlq: DeadLetterQueue;
  private cacheManager?: CacheManager;
  
  /**
   * Creates a new OrdinalsIndexer instance
   * 
   * @param config - Configuration for the indexer client
   * @param db - Optional database for caching results
   * @param logger - Optional custom logger
   * @param errorHandler - Optional custom error handler
   * @param dlq - Optional custom DLQ
   * @param cacheManager - Optional custom cache manager
   */
  constructor(
    config: OrdinalsIndexerConfig,
    db?: IndexerDatabase,
    logger?: Logger,
    errorHandler?: ErrorHandler,
    dlq?: DeadLetterQueue,
    cacheManager?: CacheManager
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = db;
    
    // Initialize error handling components
    this.logger = logger || new Logger({ prefix: 'OrdinalsIndexer' });
    this.dlq = dlq || new DeadLetterQueue(new MemoryDLQStorage());
    
    this.errorHandler = errorHandler || new ErrorHandler({
      logger: this.logger,
      dlq: this.dlq,
      defaultRetryOptions: {
        maxRetries: this.config.maxRetries || 3,
        baseDelay: 500,
        maxDelay: this.config.timeout || 30000,
        backoffFactor: 2,
        jitterFactor: 0.1
      },
      defaultServiceKey: 'ordinalsIndexer'
    });
    
    // Initialize caching if enabled
    if (this.config.enableCaching) {
      this.cacheManager = cacheManager || new CacheManager({
        defaultTTL: this.config.cacheTTL,
        logLevel: LogLevel.INFO
      });
      
      this.logger.info('Caching enabled for indexer client', {
        cacheTTL: this.config.cacheTTL
      });
    }
    
    // Initialize fetch client
    const fetchConfig: FetchRequestConfig = {
      baseURL: this.config.indexerUrl,
      timeout: this.config.timeout,
      headers: {}
    };
    
    // Add API key if provided
    if (this.config.apiKey) {
      fetchConfig.headers = {
        ...fetchConfig.headers,
        'Authorization': `Bearer ${this.config.apiKey}`
      };
    }
    
    this.client = createFetchClient(fetchConfig);
    
    this.logger.info('Initialized OrdinalsIndexer', { 
      indexerUrl: this.config.indexerUrl,
      hasDatabase: !!this.db,
      hasCacheManager: !!this.cacheManager
    });
  }
  
  /**
   * Fetches an inscription by its ID
   * 
   * @param inscriptionId - The ID of the inscription to fetch
   * @returns The inscription data or null if not found
   */
  async getInscriptionById(inscriptionId: string): Promise<IndexerInscription | null> {
    this.logger.debug(`Fetching inscription: ${inscriptionId}`);
    
    return this.errorHandler.handle(
      async () => {
        // Try local cache first if database is provided
        if (this.db) {
          this.logger.debug(`Checking cache for inscription: ${inscriptionId}`);
          const cached = await this.db.getInscription(inscriptionId);
          if (cached) {
            this.logger.debug(`Cache hit for inscription: ${inscriptionId}`);
            return cached;
          }
          this.logger.debug(`Cache miss for inscription: ${inscriptionId}`);
        }
        
        // Query indexer
        this.logger.debug(`Querying indexer for inscription: ${inscriptionId}`);
        const response = await this.client.get(`/inscription/${inscriptionId}`);
        
        if (!response.data) {
          this.logger.debug(`No data returned for inscription: ${inscriptionId}`);
          return null;
        }
        
        // Parse and store inscription data
        const inscription = this.parseInscriptionData(response.data);
        
        // Cache result if database is provided
        if (this.db) {
          this.logger.debug(`Caching inscription: ${inscriptionId}`);
          await this.db.storeInscription(inscription);
        }
        
        return inscription;
      },
      {
        operation: 'getInscriptionById',
        useCircuitBreaker: true,
        useRetry: true,
        useDLQ: true
      },
      { inscriptionId }
    );
  }
  
  /**
   * Fetches inscriptions by satoshi number
   * 
   * @param satoshi - The satoshi number to query
   * @param params - Optional pagination parameters
   * @returns Array of inscriptions on the satoshi
   */
  async getInscriptionsBySatoshi(
    satoshi: string,
    params?: InscriptionSearchParams
  ): Promise<PaginatedResponse<IndexerInscription>> {
    this.logger.debug(`Fetching inscriptions for satoshi: ${satoshi}`, params);
    
    return this.errorHandler.handle(
      async () => {
        // Try local cache first if database is provided and no pagination params
        if (this.db && !params) {
          this.logger.debug(`Checking cache for satoshi: ${satoshi}`);
          const cached = await this.db.getInscriptionsBySatoshi(satoshi);
          if (cached.length > 0) {
            this.logger.debug(`Cache hit for satoshi: ${satoshi}, found ${cached.length} items`);
            return {
              items: cached,
              total: cached.length,
              page: 1,
              pageSize: cached.length
            };
          }
          this.logger.debug(`Cache miss for satoshi: ${satoshi}`);
        }
        
        // Prepare query parameters
        const queryParams = new URLSearchParams();
        if (params?.page) queryParams.append('page', params.page.toString());
        if (params?.limit) queryParams.append('limit', params.limit.toString());
        if (params?.contentType) queryParams.append('contentType', params.contentType);
        if (params?.hasMetadata !== undefined) queryParams.append('hasMetadata', params.hasMetadata.toString());
        
        // Query indexer
        this.logger.debug(`Querying indexer for satoshi: ${satoshi} with params: ${queryParams.toString()}`);
        const response = await this.client.get(
          `/satoshi/${satoshi}/inscriptions?${queryParams.toString()}`
        );
        
        if (!response.data || !Array.isArray(response.data.items)) {
          this.logger.debug(`No valid data returned for satoshi: ${satoshi}`);
          return { items: [], total: 0, page: 1, pageSize: 0 };
        }
        
        // Parse response data
        const paginatedResponse = response.data as PaginatedResponse<any>;
        const inscriptions = paginatedResponse.items.map(item => this.parseInscriptionData(item));
        
        // Cache results if database is provided
        if (this.db) {
          this.logger.debug(`Caching ${inscriptions.length} inscriptions for satoshi: ${satoshi}`);
          for (const inscription of inscriptions) {
            await this.db.storeInscription(inscription);
          }
        }
        
        return {
          items: inscriptions,
          total: paginatedResponse.total,
          page: paginatedResponse.page,
          pageSize: paginatedResponse.pageSize,
          nextPageToken: paginatedResponse.nextPageToken
        };
      },
      {
        operation: 'getInscriptionsBySatoshi',
        useCircuitBreaker: true,
        useRetry: true,
        useDLQ: true
      },
      { satoshi, params }
    );
  }
  
  /**
   * Fetches raw inscription content
   * 
   * @param inscriptionId - The ID of the inscription
   * @returns Buffer containing the raw inscription content or null if not found
   */
  async getInscriptionContent(inscriptionId: string): Promise<Buffer | null> {
    this.logger.debug(`Fetching content for inscription: ${inscriptionId}`);
    
    return this.errorHandler.handle(
      async () => {
        // Try local cache first if database is provided
        if (this.db) {
          this.logger.debug(`Checking cache for content: ${inscriptionId}`);
          const cached = await this.db.getInscriptionContent(inscriptionId);
          if (cached) {
            this.logger.debug(`Cache hit for content: ${inscriptionId}`);
            return cached;
          }
          this.logger.debug(`Cache miss for content: ${inscriptionId}`);
        }
        
        // Query indexer
        this.logger.debug(`Querying indexer for content: ${inscriptionId}`);
        const response = await this.client.get(
          `/inscription/${inscriptionId}/content`,
          { responseType: 'arraybuffer' }
        );
        
        if (!response.data) {
          this.logger.debug(`No content returned for inscription: ${inscriptionId}`);
          return null;
        }
        
        const content = Buffer.from(response.data);
        
        // Cache content if database is provided
        if (this.db) {
          this.logger.debug(`Caching content for inscription: ${inscriptionId}, size: ${content.length}`);
          await this.db.storeInscriptionContent(inscriptionId, content);
        }
        
        return content;
      },
      {
        operation: 'getInscriptionContent',
        useCircuitBreaker: true,
        useRetry: true,
        useDLQ: true
      },
      { inscriptionId }
    );
  }
  
  /**
   * Fetches and decodes CBOR metadata from an inscription
   * 
   * @param inscriptionId - The ID of the inscription
   * @returns Decoded metadata object or null if no metadata exists
   */
  async getInscriptionMetadata(inscriptionId: string): Promise<any | null> {
    this.logger.debug(`Fetching metadata for inscription: ${inscriptionId}`);
    
    return this.errorHandler.handle(
      async () => {
        if (!this.db) {
          this.logger.warn('Database not configured. Cannot get/store inscription metadata.');
          return null;
        }
        
        // Try cache first
        const cached = await this.db.getInscriptionMetadata(inscriptionId);
        if (cached) {
          this.logger.debug(`Cache hit for metadata: ${inscriptionId}`);
          return cached;
        }
        this.logger.debug(`Cache miss for metadata: ${inscriptionId}, fetching from indexer`);

        // Get the inscription to check if it has metadata
        const inscription = await this.getInscriptionById(inscriptionId);
        if (!inscription) {
          this.logger.warn(`Inscription ${inscriptionId} not found when trying to fetch metadata`);
          return null;
        }
        
        if (!inscription.hasMetadata) {
          this.logger.debug(`Inscription ${inscriptionId} has no metadata flag. Not fetching metadata`);
          return null;
        }

        this.logger.debug(`Fetching raw metadata for inscription: ${inscriptionId}`);
        const response = await this.client.get(
          `/inscription/${inscriptionId}/metadata`,
          { responseType: 'arraybuffer' }
        );

        if (!response.data || response.data.byteLength === 0) {
          this.logger.warn(`No metadata content returned for inscription ${inscriptionId}`);
          await this.db.storeInscriptionMetadata(inscriptionId, null);
          return null;
        }

        const metadataBuffer = Buffer.from(response.data);
        
        // Decode CBOR metadata with error handling
        let metadata;
        try {
          this.logger.debug(`Decoding metadata for inscription: ${inscriptionId}`);
          metadata = extractCborMetadata(new Uint8Array(metadataBuffer));
        } catch (error) {
          throw new DataParsingError(
            `Failed to decode CBOR metadata for inscription ${inscriptionId}`,
            { 
              cause: error as Error,
              context: { 
                inscriptionId,
                contentLength: metadataBuffer.length,
                contentPreview: metadataBuffer.slice(0, 100).toString('hex')
              }
            }
          );
        }

        // Cache decoded metadata
        this.logger.debug(`Caching decoded metadata for inscription: ${inscriptionId}`);
        await this.db.storeInscriptionMetadata(inscriptionId, metadata);

        return metadata;
      },
      {
        operation: 'getInscriptionMetadata',
        useCircuitBreaker: true,
        useRetry: true,
        useDLQ: true
      },
      { inscriptionId }
    );
  }
  
  /**
   * Fetches inscriptions from the indexer based on search criteria
   * 
   * @param params - Search parameters
   * @returns Paginated response with matching inscriptions
   */
  async searchInscriptions(
    params: InscriptionSearchParams = {}
  ): Promise<PaginatedResponse<IndexerInscription>> {
    try {
      // Prepare query parameters
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.limit) queryParams.append('limit', params.limit.toString());
      if (params.contentType) queryParams.append('contentType', params.contentType);
      if (params.address) queryParams.append('address', params.address);
      if (params.hasMetadata !== undefined) queryParams.append('hasMetadata', params.hasMetadata.toString());
      
      // Add block height range if provided
      if (params.blockHeight?.min) queryParams.append('fromBlock', params.blockHeight.min.toString());
      if (params.blockHeight?.max) queryParams.append('toBlock', params.blockHeight.max.toString());
      
      // Add timestamp range if provided
      if (params.timestamp?.from) queryParams.append('fromTimestamp', Math.floor(params.timestamp.from.getTime() / 1000).toString());
      if (params.timestamp?.to) queryParams.append('toTimestamp', Math.floor(params.timestamp.to.getTime() / 1000).toString());
      
      // Add continuation token if provided
      if (params.nextPageToken) queryParams.append('nextPageToken', params.nextPageToken);
      
      // Query indexer
      const response = await this.client.get(`/inscriptions?${queryParams.toString()}`);
      
      if (!response.data || !Array.isArray(response.data.items)) {
        return { items: [], total: 0, page: 1, pageSize: 0 };
      }
      
      // Parse response data
      const paginatedResponse = response.data as PaginatedResponse<any>;
      const inscriptions = paginatedResponse.items.map(item => this.parseInscriptionData(item));
      
      // Cache results if database is provided
      if (this.db) {
        for (const inscription of inscriptions) {
          await this.db.storeInscription(inscription);
        }
      }
      
      return {
        items: inscriptions,
        total: paginatedResponse.total,
        page: paginatedResponse.page,
        pageSize: paginatedResponse.pageSize,
        nextPageToken: paginatedResponse.nextPageToken
      };
    } catch (error) {
      console.error('Error searching inscriptions:', error);
      return { items: [], total: 0, page: 1, pageSize: 0 };
    }
  }
  
  /**
   * Synchronizes recent inscriptions since the last sync
   * 
   * @returns Number of new inscriptions processed
   */
  async syncRecentInscriptions(): Promise<number> {
    console.log('Starting recent inscriptions sync...');
    try {
      // Get last synced height from database
      let lastSyncedHeight = 0;
      
      if (this.db) {
        lastSyncedHeight = (await this.db.getLastSyncedHeight()) || 0;
        console.log(`Last synced block height: ${lastSyncedHeight}`);
      }
      
      // Prepare query parameters for fetching inscriptions since the last synced height
      const queryParams = new URLSearchParams();
      // Assuming the indexer supports a 'fromBlock' or 'since' parameter.
      // Adjust if the API uses a different parameter name or mechanism (e.g., timestamp).
      queryParams.append('fromBlock', lastSyncedHeight.toString());
      // Add a limit to control batch size, if appropriate for the API
      // queryParams.append('limit', '100'); 

      console.log(`Querying indexer for inscriptions from block: ${lastSyncedHeight}`);
      // Query indexer for new inscriptions
      const response = await this.client.get(`/inscriptions?${queryParams.toString()}`);
      
      if (!response.data || !Array.isArray(response.data.items)) {
        console.log('No new inscriptions found or invalid response format.');
        return 0;
      }
      
      const paginatedResponse = response.data as PaginatedResponse<any>;
      const inscriptions = paginatedResponse.items.map(item => this.parseInscriptionData(item));
      
      // Get current block height from the response, or use lastSyncedHeight if not provided
      // The actual field name for current height might vary depending on the indexer API
      const currentChainHeight = response.data.currentHeight || response.data.chainTip || lastSyncedHeight;
      
      console.log(`Fetched ${inscriptions.length} inscriptions. Current chain height (or equivalent): ${currentChainHeight}`);

      // Process new inscriptions
      let processedCount = 0;
      
      for (const inscription of inscriptions) {
        console.log(`Processing inscription ID: ${inscription.id}, Number: ${inscription.number}`);
        // Cache the inscription
        if (this.db) {
          await this.db.storeInscription(inscription);
          console.log(`Stored inscription ID: ${inscription.id}`);
        }
        
        // Check if this inscription has metadata we care about
        if (inscription.hasMetadata) {
          console.log(`Inscription ID: ${inscription.id} has metadata. Processing...`);
          await this.processInscriptionMetadata(inscription.id);
        }
        
        processedCount++;
      }
      
      // Update last synced height only if new inscriptions were processed and chain height advanced
      if (this.db && processedCount > 0 && currentChainHeight > lastSyncedHeight) {
        await this.db.setLastSyncedHeight(currentChainHeight);
        console.log(`Updated last synced block height to: ${currentChainHeight}`);
      } else if (processedCount === 0) {
        console.log('No new inscriptions processed. Last synced height remains unchanged.');
      } else if (currentChainHeight <= lastSyncedHeight) {
        console.log(`Current chain height (${currentChainHeight}) not greater than last synced height (${lastSyncedHeight}). Last synced height remains unchanged.`);
      }
      
      console.log(`Sync completed. Processed ${processedCount} new inscriptions.`);
      return processedCount;
    } catch (error) {
      console.error('Error syncing recent inscriptions:', error instanceof Error ? error.message : error);
      if (this.client.isFetchError(error)) {
        console.error('Fetch error details:', {
          url: error.request?.url,
          method: error.request?.method,
          status: error.status,
          data: error.data,
        });
      }
      return 0;
    }
  }
  
  /**
   * Processes an inscription's metadata to extract DID documents and credentials
   * 
   * @param inscriptionId - The ID of the inscription to process
   */
  private async processInscriptionMetadata(inscriptionId: string): Promise<void> {
    this.logger.debug(`Processing metadata for inscription: ${inscriptionId}`);
    
    return this.errorHandler.handle(
      async () => {
        // Get and decode metadata
        const metadata = await this.getInscriptionMetadata(inscriptionId);
        if (!metadata) {
          this.logger.debug(`No metadata found for inscription: ${inscriptionId}`);
          return;
        }

        if (!this.db) {
          this.logger.warn('Database not configured. Cannot store processed metadata.');
          return;
        }

        // Check if this is a DID Document
        if (metadata.didDocument && metadata.didDocument.id?.startsWith('did:btco:')) {
          this.logger.info(`Found DID document in inscription: ${inscriptionId}`, {
            didId: metadata.didDocument.id
          });
          await this.db.storeDIDDocument(metadata.didDocument.id, metadata.didDocument);
        }

        // Check if this is a verifiable credential
        // VC properties should be at the top level according to W3C VC spec
        if (metadata.type?.includes('VerifiableCredential') ||
            (Array.isArray(metadata.type) && metadata.type.includes('VerifiableCredential'))) {
          this.logger.info(`Found verifiable credential in inscription: ${inscriptionId}`);
          await this.db.storeCredential(inscriptionId, metadata);
        }
      },
      {
        operation: 'processInscriptionMetadata',
        useCircuitBreaker: false,
        useRetry: true,
        useDLQ: true
      },
      { inscriptionId }
    );
  }
  
  /**
   * Parses raw inscription data from the indexer into a standardized format
   * 
   * @param data - Raw inscription data from the indexer API
   * @returns Parsed IndexerInscription object
   */
  private parseInscriptionData(data: any): IndexerInscription {
    try {
      return {
        id: data.id,
        number: parseInt(data.number || '0', 10),
        satoshi: data.sat?.toString() || '0',
        contentType: data.content_type || data.contentType || 'application/octet-stream',
        hasMetadata: !!data.metadata || !!data.hasMetadata,
        timestamp: data.timestamp || Math.floor(Date.now() / 1000),
        index: data.sat_index || data.index || 0,
        ownerAddress: data.address || data.owner || '',
        txid: data.genesis_tx || data.txid || '',
        contentLength: data.content_length || data.contentLength || 0
      };
    } catch (error) {
      throw new DataParsingError(
        `Failed to parse inscription data`,
        { 
          cause: error as Error,
          context: { data: JSON.stringify(data).slice(0, 1000) }
        }
      );
    }
  }

  /**
   * Sets the logger level
   * 
   * @param level - New log level
   */
  setLogLevel(level: LogLevel | string): void {
    this.logger.setLevel(level);
  }
  
  /**
   * Returns the current logger instance
   */
  getLogger(): Logger {
    return this.logger;
  }
  
  /**
   * Returns the DLQ instance
   */
  getDLQ(): DeadLetterQueue {
    return this.dlq;
  }
} 