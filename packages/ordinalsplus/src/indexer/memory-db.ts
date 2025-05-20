/**
 * In-memory implementation of the IndexerDatabase interface for testing and development
 */

import { IndexerDatabase, IndexerInscription } from '../types';

/**
 * MemoryIndexerDatabase provides a simple in-memory implementation of IndexerDatabase
 * 
 * This is primarily useful for testing, development, and small-scale usage.
 * Production applications should implement a persistent database solution.
 */
export class MemoryIndexerDatabase implements IndexerDatabase {
  private inscriptions: Map<string, IndexerInscription> = new Map();
  private contents: Map<string, Buffer> = new Map();
  private metadata: Map<string, any> = new Map();
  private satoshipIndexes: Map<string, string[]> = new Map();
  private didDocuments: Map<string, any> = new Map();
  private credentials: Map<string, any> = new Map();
  private lastSyncedHeight: number = 0;
  
  /**
   * Get an inscription by its ID
   */
  async getInscription(id: string): Promise<IndexerInscription | null> {
    return this.inscriptions.get(id) || null;
  }
  
  /**
   * Store an inscription
   */
  async storeInscription(inscription: IndexerInscription): Promise<void> {
    this.inscriptions.set(inscription.id, inscription);
    
    // Update satoshi index
    const satoshi = inscription.satoshi;
    if (satoshi) {
      const ids = this.satoshipIndexes.get(satoshi) || [];
      if (!ids.includes(inscription.id)) {
        ids.push(inscription.id);
        this.satoshipIndexes.set(satoshi, ids);
      }
    }
  }
  
  /**
   * Get inscriptions associated with a satoshi
   */
  async getInscriptionsBySatoshi(satoshi: string): Promise<IndexerInscription[]> {
    const ids = this.satoshipIndexes.get(satoshi) || [];
    return ids
      .map(id => this.inscriptions.get(id))
      .filter(Boolean) as IndexerInscription[];
  }
  
  /**
   * Get raw inscription content
   */
  async getInscriptionContent(id: string): Promise<Buffer | null> {
    return this.contents.get(id) || null;
  }
  
  /**
   * Store raw inscription content
   */
  async storeInscriptionContent(id: string, content: Buffer): Promise<void> {
    this.contents.set(id, content);
  }
  
  /**
   * Get decoded metadata for an inscription
   */
  async getInscriptionMetadata(id: string): Promise<any | null> {
    return this.metadata.get(id) || null;
  }
  
  /**
   * Store decoded metadata for an inscription
   */
  async storeInscriptionMetadata(id: string, metadata: any): Promise<void> {
    this.metadata.set(id, metadata);
  }
  
  /**
   * Get the last synced block height
   */
  async getLastSyncedHeight(): Promise<number | null> {
    return this.lastSyncedHeight;
  }
  
  /**
   * Update the last synced block height
   */
  async setLastSyncedHeight(height: number): Promise<void> {
    this.lastSyncedHeight = height;
  }
  
  /**
   * Store a DID document
   */
  async storeDIDDocument(didId: string, document: any): Promise<void> {
    this.didDocuments.set(didId, document);
  }
  
  /**
   * Store a verifiable credential
   */
  async storeCredential(inscriptionId: string, credential: any): Promise<void> {
    this.credentials.set(inscriptionId, credential);
  }
  
  /**
   * Get all stored inscriptions (for testing)
   */
  async getAllInscriptions(): Promise<IndexerInscription[]> {
    return Array.from(this.inscriptions.values());
  }
  
  /**
   * Get a DID document by ID (for testing)
   */
  async getDIDDocument(didId: string): Promise<any | null> {
    return this.didDocuments.get(didId) || null;
  }
  
  /**
   * Get a credential by inscription ID (for testing)
   */
  async getCredential(inscriptionId: string): Promise<any | null> {
    return this.credentials.get(inscriptionId) || null;
  }
  
  /**
   * Clear all stored data (for testing)
   */
  async clearAll(): Promise<void> {
    this.inscriptions.clear();
    this.contents.clear();
    this.metadata.clear();
    this.satoshipIndexes.clear();
    this.didDocuments.clear();
    this.credentials.clear();
    this.lastSyncedHeight = 0;
  }
} 