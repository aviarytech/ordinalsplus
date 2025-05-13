/**
 * Ordinals Indexer Client Implementation
 * 
 * Provides a client for interacting with an Ordinals indexer API, with support for
 * caching, retries, and CBOR metadata handling.
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
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
    try {
      // Try local cache first if database is provided
      if (this.db) {
        const cached = await this.db.getInscriptionMetadata(inscriptionId);
        if (cached) {
          return cached;
        }
      }
      
      // Get the inscription to check if it has metadata
      const inscription = await this.getInscriptionById(inscriptionId);
      if (!inscription || !inscription.hasMetadata) {
        return null;
      }
      
      // Query indexer for raw metadata
      const response = await this.client.get(
        `/inscription/${inscriptionId}/metadata`,
        { responseType: 'arraybuffer' }
      );
      
      if (!response.data) {
        return null;
      }
      
      // Decode CBOR metadata
      const metadataBuffer = Buffer.from(response.data);
      let metadata;
      
      try {
        metadata = decode(metadataBuffer);
      } catch (decodeError) {
        console.error('Error decoding CBOR metadata:', decodeError);
        return null;
      }
      
      // Cache decoded metadata if database is provided
      if (this.db) {
        await this.db.storeInscriptionMetadata(inscriptionId, metadata);
      }
      
      return metadata;
    } catch (error) {
      console.error('Error fetching inscription metadata:', error);
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
    try {
      // Get last synced height from database
      let lastSyncedHeight = 0;
      
      if (this.db) {
        lastSyncedHeight = (await this.db.getLastSyncedHeight()) || 0;
      }
      
      // Query indexer for new inscriptions
      const response = await this.client.get(`/inscriptions?fromBlock=${lastSyncedHeight}`);
      
      if (!response.data || !Array.isArray(response.data.items)) {
        return 0;
      }
      
      const paginatedResponse = response.data as PaginatedResponse<any>;
      const inscriptions = paginatedResponse.items.map(item => this.parseInscriptionData(item));
      
      // Get current block height
      const currentHeight = response.data.currentHeight || lastSyncedHeight;
      
      // Process new inscriptions
      let processedCount = 0;
      
      for (const inscription of inscriptions) {
        // Cache the inscription
        if (this.db) {
          await this.db.storeInscription(inscription);
        }
        
        // Check if this inscription has metadata we care about
        if (inscription.hasMetadata) {
          await this.processInscriptionMetadata(inscription.id);
        }
        
        processedCount++;
      }
      
      // Update last synced height
      if (this.db && currentHeight > lastSyncedHeight) {
        await this.db.setLastSyncedHeight(currentHeight);
      }
      
      return processedCount;
    } catch (error) {
      console.error('Error syncing recent inscriptions:', error);
      return 0;
    }
  }
  
  /**
   * Processes an inscription's metadata to extract DID documents and credentials
   * 
   * @param inscriptionId - The ID of the inscription to process
   */
  private async processInscriptionMetadata(inscriptionId: string): Promise<void> {
    if (!this.db) return;
    
    // Get and decode metadata
    const metadata = await this.getInscriptionMetadata(inscriptionId);
    if (!metadata) return;
    
    // Check if this is a DID Document
    if (metadata.didDocument && metadata.didDocument.id?.startsWith('did:btco:')) {
      await this.db.storeDIDDocument(metadata.didDocument.id, metadata.didDocument);
    }
    
    // Check if this is a verifiable credential
    if (metadata.verifiableCredential &&
        metadata.verifiableCredential.type?.includes('VerifiableCredential')) {
      await this.db.storeCredential(inscriptionId, metadata.verifiableCredential);
    }
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
} 