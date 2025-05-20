/**
 * Types for the Ordinals Indexer integration
 */

/**
 * Configuration for the Ordinals Indexer client
 */
export interface OrdinalsIndexerConfig {
  /**
   * URL of the Ordinals indexer API
   */
  indexerUrl: string;
  
  /**
   * Optional Bitcoin RPC URL for direct node access if needed
   */
  bitcoinRpcUrl?: string;
  
  /**
   * Optional authentication for Bitcoin RPC
   */
  bitcoinRpcAuth?: {
    username: string;
    password: string;
  };
  
  /**
   * Optional API key for the indexer service
   */
  apiKey?: string;
  
  /**
   * Request timeout in milliseconds
   */
  timeout?: number;
  
  /**
   * Maximum number of retries for failed requests
   */
  maxRetries?: number;
  
  /**
   * Whether to enable caching for indexer requests
   */
  enableCaching?: boolean;
  
  /**
   * Time-to-live for cached items in milliseconds
   */
  cacheTTL?: number;
  
  /**
   * Maximum number of items to store in memory cache
   */
  cacheMaxItems?: number;
}

/**
 * Extended Inscription type with additional fields from indexer
 */
export interface IndexerInscription {
  /**
   * Unique identifier for the inscription
   */
  id: string;
  
  /**
   * Sequential number of the inscription (global counter)
   */
  number: number;
  
  /**
   * The satoshi number that holds this inscription
   */
  satoshi: string;
  
  /**
   * MIME content type of the inscription
   */
  contentType: string;
  
  /**
   * Whether the inscription has metadata
   */
  hasMetadata: boolean;
  
  /**
   * Timestamp when the inscription was created
   */
  timestamp: number;
  
  /**
   * Index number for this inscription on this specific satoshi
   */
  index: number;
  
  /**
   * Current owner's address
   */
  ownerAddress: string;
  
  /**
   * Genesis transaction ID
   */
  txid: string;
  
  /**
   * Size of the inscription content in bytes
   */
  contentLength: number;
}

/**
 * Paginated response from the indexer
 */
export interface PaginatedResponse<T> {
  /**
   * Items in the current page
   */
  items: T[];
  
  /**
   * Total number of items across all pages
   */
  total: number;
  
  /**
   * Current page number
   */
  page: number;
  
  /**
   * Number of items per page
   */
  pageSize: number;
  
  /**
   * Token for fetching the next page, if available
   */
  nextPageToken?: string;
}

/**
 * Parameters for query pagination
 */
export interface PaginationParams {
  /**
   * Page number (1-based)
   */
  page?: number;
  
  /**
   * Number of items per page
   */
  limit?: number;
  
  /**
   * Continuation token for pagination
   */
  nextPageToken?: string;
}

/**
 * Parameters for inscription search
 */
export interface InscriptionSearchParams extends PaginationParams {
  /**
   * Filter by content type
   */
  contentType?: string;
  
  /**
   * Filter by block height range
   */
  blockHeight?: {
    min?: number;
    max?: number;
  };
  
  /**
   * Filter by inscription creation date range
   */
  timestamp?: {
    from?: Date;
    to?: Date;
  };
  
  /**
   * Filter by address
   */
  address?: string;
  
  /**
   * Only include inscriptions with metadata
   */
  hasMetadata?: boolean;
}

/**
 * Database interface for caching inscription data
 */
export interface IndexerDatabase {
  /**
   * Get an inscription by its ID
   */
  getInscription(id: string): Promise<IndexerInscription | null>;
  
  /**
   * Store an inscription
   */
  storeInscription(inscription: IndexerInscription): Promise<void>;
  
  /**
   * Get inscriptions associated with a satoshi
   */
  getInscriptionsBySatoshi(satoshi: string): Promise<IndexerInscription[]>;
  
  /**
   * Get raw inscription content
   */
  getInscriptionContent(id: string): Promise<Buffer | null>;
  
  /**
   * Store raw inscription content
   */
  storeInscriptionContent(id: string, content: Buffer): Promise<void>;
  
  /**
   * Get decoded metadata for an inscription
   */
  getInscriptionMetadata(id: string): Promise<any | null>;
  
  /**
   * Store decoded metadata for an inscription
   */
  storeInscriptionMetadata(id: string, metadata: any): Promise<void>;
  
  /**
   * Get the last synced block height
   */
  getLastSyncedHeight(): Promise<number | null>;
  
  /**
   * Update the last synced block height
   */
  setLastSyncedHeight(height: number): Promise<void>;
  
  /**
   * Store a DID document
   */
  storeDIDDocument(didId: string, document: any): Promise<void>;
  
  /**
   * Store a verifiable credential
   */
  storeCredential(inscriptionId: string, credential: any): Promise<void>;
} 