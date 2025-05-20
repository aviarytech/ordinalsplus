/**
 * Collection Inscription Types
 * 
 * This module defines TypeScript interfaces for on-chain inscriptions
 * of collection data and metadata.
 */
import type { Collection, CollectionItem, CollectionMetadata } from './collection';
import type { Transaction } from '../services/transactionService';

/**
 * Status of a collection inscription
 */
export enum CollectionInscriptionStatus {
  /** Inscription process has been initiated but not yet started */
  PENDING = 'pending',
  /** Inscription is currently in progress */
  IN_PROGRESS = 'in-progress',
  /** Inscription has been successfully completed */
  COMPLETED = 'completed',
  /** Inscription process has failed */
  FAILED = 'failed',
  /** Inscription has been cancelled */
  CANCELLED = 'cancelled'
}

/**
 * Optimized collection data for on-chain inscription
 * This is a more compact representation of a collection for on-chain storage
 */
export interface InscriptionCollectionData {
  /** Collection metadata */
  m: {
    /** Name of the collection */
    n: string;
    /** Description of the collection */
    d: string;
    /** Image URL (optional) */
    i?: string;
    /** Category */
    c: string;
    /** Tags (optional) */
    t?: string[];
    /** Creation timestamp */
    ct: number;
  };
  /** Collection items (array of DIDs or inscription IDs) */
  items: string[];
  /** Curator DID */
  curator: string;
  /** Collection credential ID (if available) */
  credId?: string;
  /** Collection ID in the database */
  id: string;
}

/**
 * Collection inscription request parameters
 */
export interface CollectionInscriptionRequest {
  /** Collection ID to inscribe */
  collectionId: string;
  /** DID of the user requesting the inscription */
  requesterDid: string;
  /** Fee rate in sats/vbyte (optional, system will use default if not provided) */
  feeRate?: number;
  /** Whether to use batching for large collections */
  useBatching?: boolean;
  /** Maximum items per batch if batching is enabled */
  batchSize?: number;
}

/**
 * Collection inscription record
 */
export interface CollectionInscription {
  /** Unique identifier for this inscription process */
  id: string;
  /** Collection being inscribed */
  collectionId: string;
  /** DID of the user who requested the inscription */
  requesterDid: string;
  /** Current status of the inscription */
  status: CollectionInscriptionStatus;
  /** Timestamp when the inscription was requested */
  requestedAt: string;
  /** Timestamp when the inscription was last updated */
  updatedAt: string;
  /** Timestamp when the inscription was completed (if successful) */
  completedAt?: string;
  /** Error message if the inscription failed */
  error?: string;
  /** Inscription ID once completed */
  inscriptionId?: string;
  /** Transaction IDs for the commit and reveal transactions */
  transactions?: {
    /** Commit transaction ID */
    commitTxId?: string;
    /** Reveal transaction ID */
    revealTxId?: string;
  };
  /** Fee information */
  fees?: {
    /** Fee rate used (sats/vbyte) */
    feeRate: number;
    /** Total fees paid (in sats) */
    total: number;
    /** Commit transaction fee */
    commit: number;
    /** Reveal transaction fee */
    reveal: number;
  };
  /** Batching information if the collection was inscribed in batches */
  batching?: {
    /** Whether batching was used */
    enabled: boolean;
    /** Total number of batches */
    totalBatches: number;
    /** Number of completed batches */
    completedBatches: number;
    /** Batch inscription IDs */
    batchInscriptionIds: string[];
  };
}

/**
 * Collection inscription status update
 */
export interface CollectionInscriptionUpdate {
  /** New status */
  status?: CollectionInscriptionStatus;
  /** Error message if failed */
  error?: string;
  /** Inscription ID if completed */
  inscriptionId?: string;
  /** Transaction IDs */
  transactions?: {
    /** Commit transaction ID */
    commitTxId?: string;
    /** Reveal transaction ID */
    revealTxId?: string;
  };
  /** Updated fee information */
  fees?: {
    /** Fee rate used (sats/vbyte) */
    feeRate?: number;
    /** Total fees paid (in sats) */
    total?: number;
    /** Commit transaction fee */
    commit?: number;
    /** Reveal transaction fee */
    reveal?: number;
  };
  /** Batching updates */
  batching?: {
    /** Number of completed batches */
    completedBatches?: number;
    /** New batch inscription IDs */
    newBatchInscriptionIds?: string[];
  };
}

/**
 * Collection inscription verification result
 */
export interface CollectionInscriptionVerification {
  /** Whether the inscription is valid */
  isValid: boolean;
  /** Verification timestamp */
  verifiedAt: string;
  /** Collection ID */
  collectionId: string;
  /** Inscription ID */
  inscriptionId: string;
  /** Collection data from the inscription */
  inscriptionData?: InscriptionCollectionData;
  /** Verification failures if any */
  failures?: string[];
}

/**
 * Repository interface for collection inscriptions
 */
export interface CollectionInscriptionRepository {
  /**
   * Create a new collection inscription record
   * 
   * @param inscription - The inscription record to create
   * @returns The created inscription record with generated ID
   */
  createInscription(inscription: Omit<CollectionInscription, 'id'>): Promise<CollectionInscription>;
  
  /**
   * Get a collection inscription by ID
   * 
   * @param id - The ID of the inscription
   * @returns The inscription record if found, null otherwise
   */
  getInscriptionById(id: string): Promise<CollectionInscription | null>;
  
  /**
   * Get inscriptions for a collection
   * 
   * @param collectionId - The ID of the collection
   * @returns Array of inscription records for the collection
   */
  getInscriptionsByCollectionId(collectionId: string): Promise<CollectionInscription[]>;
  
  /**
   * Update a collection inscription
   * 
   * @param id - The ID of the inscription to update
   * @param update - The update to apply
   * @returns The updated inscription record
   */
  updateInscription(id: string, update: CollectionInscriptionUpdate): Promise<CollectionInscription>;
  
  /**
   * Delete a collection inscription
   * 
   * @param id - The ID of the inscription to delete
   * @returns True if deleted, false if not found
   */
  deleteInscription(id: string): Promise<boolean>;
}
