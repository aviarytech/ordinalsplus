/**
 * Ordinals Indexer Client Implementation
 * 
 * Provides a client for interacting with an Ordinals indexer API, with support for
 * caching, retries, and CBOR metadata handling.
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { decode } from 'cbor';
import { 
  OrdinalsIndexerConfig, 
  IndexerInscription, 
  IndexerDatabase,
  PaginatedResponse,
  InscriptionSearchParams 
} from '../types';

/**
 * Default configuration for the indexer client
 */
const DEFAULT_CONFIG: Partial<OrdinalsIndexerConfig> = {
  timeout: 30000, // 30 seconds
  maxRetries: 3
};

/**
 * OrdinalsIndexer class provides methods to interact with an Ordinals indexer API
 */
export class OrdinalsIndexer {
  private client: AxiosInstance;
  private config: OrdinalsIndexerConfig;
  private db?: IndexerDatabase;
  
  /**
   * Creates a new OrdinalsIndexer instance
   * 
   * @param config - Configuration for the indexer client
   * @param db - Optional database for caching results
   */
  constructor(
    config: OrdinalsIndexerConfig,
    db?: IndexerDatabase
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.db = db;
    
    // Initialize axios client
    const axiosConfig: AxiosRequestConfig = {
      baseURL: this.config.indexerUrl,
      timeout: this.config.timeout,
      headers: {}
    };
    
    // Add API key if provided
    if (this.config.apiKey) {
      axiosConfig.headers = {
        ...axiosConfig.headers,
        'Authorization': `Bearer ${this.config.apiKey}`
      };
    }
    
    this.client = axios.create(axiosConfig);
  }
  
  /**
   * Fetches an inscription by its ID
   * 
   * @param inscriptionId - The ID of the inscription to fetch
   * @returns The inscription data or null if not found
   */
  async getInscriptionById(inscriptionId: string): Promise<IndexerInscription | null> {
    try {
      // Try local cache first if database is provided
      if (this.db) {
        const cached = await this.db.getInscription(inscriptionId);
        if (cached) {
          return cached;
        }
      }
      
      // Query indexer
      const response = await this.client.get(`/inscription/${inscriptionId}`);
      
      if (!response.data) {
        return null;
      }
      
      // Parse and store inscription data
      const inscription = this.parseInscriptionData(response.data);
      
      // Cache result if database is provided
      if (this.db) {
        await this.db.storeInscription(inscription);
      }
      
      return inscription;
    } catch (error) {
      console.error('Error fetching inscription:', error);
      return null;
    }
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
    try {
      // Try local cache first if database is provided
      if (this.db && !params) {
        const cached = await this.db.getInscriptionsBySatoshi(satoshi);
        if (cached.length > 0) {
          return {
            items: cached,
            total: cached.length,
            page: 1,
            pageSize: cached.length
          };
        }
      }
      
      // Prepare query parameters
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.contentType) queryParams.append('contentType', params.contentType);
      if (params?.hasMetadata !== undefined) queryParams.append('hasMetadata', params.hasMetadata.toString());
      
      // Query indexer
      const response = await this.client.get(
        `/satoshi/${satoshi}/inscriptions?${queryParams.toString()}`
      );
      
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
      console.error('Error fetching inscriptions by satoshi:', error);
      return { items: [], total: 0, page: 1, pageSize: 0 };
    }
  }
  
  /**
   * Fetches raw inscription content
   * 
   * @param inscriptionId - The ID of the inscription
   * @returns Buffer containing the raw inscription content or null if not found
   */
  async getInscriptionContent(inscriptionId: string): Promise<Buffer | null> {
    try {
      // Try local cache first if database is provided
      if (this.db) {
        const cached = await this.db.getInscriptionContent(inscriptionId);
        if (cached) {
          return cached;
        }
      }
      
      // Query indexer
      const response = await this.client.get(
        `/inscription/${inscriptionId}/content`,
        { responseType: 'arraybuffer' }
      );
      
      if (!response.data) {
        return null;
      }
      
      const content = Buffer.from(response.data);
      
      // Cache content if database is provided
      if (this.db) {
        await this.db.storeInscriptionContent(inscriptionId, content);
      }
      
      return content;
    } catch (error) {
      console.error('Error fetching inscription content:', error);
      return null;
    }
  }
  
  /**
   * Fetches and decodes CBOR metadata from an inscription
   * 
   * @param inscriptionId - The ID of the inscription
   * @returns Decoded metadata object or null if no metadata exists
   */
  async getInscriptionMetadata(inscriptionId: string): Promise<any | null> {
    if (!this.db) {
      this.logError('Database not configured. Cannot get/store inscription metadata.');
      return null;
    }
    try {
      const cached = await this.db.getInscriptionMetadata(inscriptionId);
      if (cached) {
        this.log(`Cache hit for metadata: ${inscriptionId}`);
        return cached;
      }
      this.log(`Cache miss for metadata: ${inscriptionId}, fetching from indexer.`);

      const inscription = await this.getInscriptionById(inscriptionId);
      if (!inscription) {
        this.logError(`Inscription ${inscriptionId} not found when trying to fetch metadata.`);
        return null;
      }
      if (!inscription.hasMetadata) {
        this.log(`Inscription ${inscriptionId} has no metadata flag. Not fetching metadata.`);
        return null;
      }

      this.log(`Fetching raw metadata for inscription: ${inscriptionId}`);
      const response = await axios.get(
        `${this.config.indexerUrl}/inscription/${inscriptionId}/metadata`,
        { responseType: 'arraybuffer' },
      );

      if (!response.data || response.data.byteLength === 0) {
        this.logError(`No metadata content returned for inscription ${inscriptionId}.`);
        if (this.db) await this.db.storeInscriptionMetadata(inscriptionId, null);
        return null;
      }

      const metadataBuffer = Buffer.from(response.data);
      let metadata;
      try {
        metadata = decode(metadataBuffer);
        this.log(`Successfully decoded CBOR metadata for ${inscriptionId}.`);
      } catch (decodingError: any) {
        this.logError(
          `CBOR decoding failed for ${inscriptionId}: ${decodingError.message || decodingError}`,
        );
        if (this.db) await this.db.storeInscriptionMetadata(inscriptionId, { undecodable: true, raw: metadataBuffer.toString('hex') });
        return null;
      }

      if (this.db) await this.db.storeInscriptionMetadata(inscriptionId, metadata);
      this.log(`Stored decoded metadata for ${inscriptionId}.`);
      return metadata;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          this.log(`Metadata not found (404) for inscription ${inscriptionId}. Caching as null.`);
          if (this.db) await this.db.storeInscriptionMetadata(inscriptionId, null);
        } else {
          this.logError(
            `Axios error fetching metadata for ${inscriptionId}: ${axiosError.message}`,
          );
        }
      } else {
        this.logError(
          `Unexpected error fetching metadata for ${inscriptionId}: ${error.message || error}`,
        );
      }
      return null;
    }
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
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
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
    if (!this.db) {
      this.logError('Database not configured. Skipping metadata processing.');
      return;
    }
    this.log(`Processing metadata for inscription: ${inscriptionId}`);
    const metadata = await this.getInscriptionMetadata(inscriptionId);

    if (!metadata) {
      this.log(`No metadata found or failed to decode for ${inscriptionId}. Skipping further processing.`);
      return;
    }

    if (metadata.undecodable) {
        this.log(`Metadata for ${inscriptionId} was marked as undecodable. Skipping further processing.`);
        return;
    }

    // Check for DID Document
    if (metadata.didDocument) {
      if (
        typeof metadata.didDocument === 'object' &&
        metadata.didDocument !== null &&
        typeof metadata.didDocument.id === 'string' &&
        metadata.didDocument.id.startsWith('did:btco:')
      ) {
        this.log(`Storing DID Document: ${metadata.didDocument.id}`);
        if (this.db) await this.db.storeDIDDocument(
          metadata.didDocument.id,
          metadata.didDocument,
        );
      } else {
        this.logWarn(
          `Malformed DID Document structure for inscription ${inscriptionId}. ID: ${metadata.didDocument.id}`,
        );
      }
    }

    // Check for Verifiable Credential
    if (metadata.verifiableCredential) {
      if (
        typeof metadata.verifiableCredential === 'object' &&
        metadata.verifiableCredential !== null &&
        Array.isArray(metadata.verifiableCredential.type) &&
        metadata.verifiableCredential.type.includes('VerifiableCredential') &&
        typeof metadata.verifiableCredential.issuer === 'string'
      ) {
        this.log(
          `Storing Verifiable Credential for inscription ${inscriptionId}`,
        );
        if (this.db) await this.db.storeCredential(
          inscriptionId,
          metadata.verifiableCredential,
        );
      } else {
        this.logWarn(
          `Malformed Verifiable Credential structure for inscription ${inscriptionId}.`,
        );
      }
    }
    this.log(`Finished processing metadata for inscription: ${inscriptionId}`);
  }
  
  /**
   * Parses raw inscription data from the indexer into a standardized format
   * 
   * @param data - Raw inscription data from the indexer API
   * @returns Parsed IndexerInscription object
   */
  private parseInscriptionData(data: any): IndexerInscription {
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
  }

  private log(message: string) {
    // In a real app, you'd use a proper logger
    console.log(`[OrdinalsIndexer] [INFO] ${new Date().toISOString()}: ${message}`);
  }

  private logWarn(message: string) {
    console.warn(`[OrdinalsIndexer] [WARN] ${new Date().toISOString()}: ${message}`);
  }

  private logError(message: string) {
    console.error(`[OrdinalsIndexer] [ERROR] ${new Date().toISOString()}: ${message}`);
  }
} 