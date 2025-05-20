/**
 * Collection Inscription Repository
 * 
 * This module provides an in-memory implementation of the collection inscription repository
 * for storing and retrieving collection inscription records.
 */
import { v4 as uuidv4 } from 'uuid';
import type { 
  CollectionInscription, 
  CollectionInscriptionRepository
} from '../types/collectionInscription';
import { CollectionInscriptionStatus } from '../types/collectionInscription';

/**
 * Update parameters for collection inscriptions
 */
interface CollectionInscriptionUpdateParams {
  /** New status */
  status?: CollectionInscriptionStatus;
  /** Error message if failed */
  error?: string;
  /** Inscription ID if completed */
  inscriptionId?: string;
  /** Timestamp when updated */
  updatedAt?: string;
  /** Timestamp when completed */
  completedAt?: string;
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
 * In-memory implementation of the collection inscription repository
 */
export class InMemoryCollectionInscriptionRepository implements CollectionInscriptionRepository {
  private inscriptions: Map<string, CollectionInscription> = new Map();

  /**
   * Create a new collection inscription record
   * 
   * @param inscription - The inscription record to create
   * @returns The created inscription record with generated ID
   */
  async createInscription(inscription: Omit<CollectionInscription, 'id'>): Promise<CollectionInscription> {
    const id = uuidv4();
    const newInscription: CollectionInscription = {
      id,
      ...inscription
    };
    
    this.inscriptions.set(id, newInscription);
    return newInscription;
  }

  /**
   * Get a collection inscription by ID
   * 
   * @param id - The ID of the inscription
   * @returns The inscription record if found, null otherwise
   */
  async getInscriptionById(id: string): Promise<CollectionInscription | null> {
    const inscription = this.inscriptions.get(id);
    return inscription || null;
  }

  /**
   * Get inscriptions for a collection
   * 
   * @param collectionId - The ID of the collection
   * @returns Array of inscription records for the collection
   */
  async getInscriptionsByCollectionId(collectionId: string): Promise<CollectionInscription[]> {
    const inscriptions: CollectionInscription[] = [];
    
    for (const inscription of this.inscriptions.values()) {
      if (inscription.collectionId === collectionId) {
        inscriptions.push(inscription);
      }
    }
    
    return inscriptions;
  }

  /**
   * Update a collection inscription
   * 
   * @param id - The ID of the inscription to update
   * @param update - The update to apply
   * @returns The updated inscription record
   * @throws Error if the inscription is not found
   */
  async updateInscription(id: string, update: CollectionInscriptionUpdateParams): Promise<CollectionInscription> {
    const inscription = this.inscriptions.get(id);
    if (!inscription) {
      throw new Error(`Inscription not found: ${id}`);
    }
    
    // Apply the updates
    const updatedInscription = { ...inscription } as CollectionInscription;
    
    // Update simple properties
    if (update.status !== undefined) updatedInscription.status = update.status;
    if (update.error !== undefined) updatedInscription.error = update.error;
    if (update.inscriptionId !== undefined) updatedInscription.inscriptionId = update.inscriptionId;
    if (update.updatedAt !== undefined) updatedInscription.updatedAt = update.updatedAt;
    if (update.completedAt !== undefined) updatedInscription.completedAt = update.completedAt;
    
    // Update nested transactions object
    if (update.transactions) {
      updatedInscription.transactions = updatedInscription.transactions || {};
      if (update.transactions.commitTxId) {
        updatedInscription.transactions.commitTxId = update.transactions.commitTxId;
      }
      if (update.transactions.revealTxId) {
        updatedInscription.transactions.revealTxId = update.transactions.revealTxId;
      }
    }
    
    // Update nested fees object
    if (update.fees) {
      updatedInscription.fees = updatedInscription.fees || {
        feeRate: 0,
        total: 0,
        commit: 0,
        reveal: 0
      };
      if (update.fees.feeRate !== undefined) updatedInscription.fees.feeRate = update.fees.feeRate;
      if (update.fees.total !== undefined) updatedInscription.fees.total = update.fees.total;
      if (update.fees.commit !== undefined) updatedInscription.fees.commit = update.fees.commit;
      if (update.fees.reveal !== undefined) updatedInscription.fees.reveal = update.fees.reveal;
    }
    
    // Update nested batching object
    if (update.batching && updatedInscription.batching) {
      if (update.batching.completedBatches !== undefined) {
        updatedInscription.batching.completedBatches = update.batching.completedBatches;
      }
      
      // Handle array of batch inscription IDs
      if (update.batching.newBatchInscriptionIds && update.batching.newBatchInscriptionIds.length > 0) {
        updatedInscription.batching.batchInscriptionIds = [
          ...updatedInscription.batching.batchInscriptionIds,
          ...update.batching.newBatchInscriptionIds
        ];
      }
    }
    
    // Remove temporary fields
    if (updatedInscription.batching && 'newBatchInscriptionIds' in update.batching!) {
      delete (update.batching as any).newBatchInscriptionIds;
    }
    
    this.inscriptions.set(id, updatedInscription);
    return updatedInscription;
  }

  /**
   * Delete a collection inscription
   * 
   * @param id - The ID of the inscription to delete
   * @returns True if deleted, false if not found
   */
  async deleteInscription(id: string): Promise<boolean> {
    return this.inscriptions.delete(id);
  }
}

export default InMemoryCollectionInscriptionRepository;
