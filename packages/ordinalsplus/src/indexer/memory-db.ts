/**
 * In-memory implementation of the IndexerDatabase interface for testing and development
 */

import { IndexerDatabase, IndexerInscription } from '../types';
import { StorageBackend, InMemoryBackend } from '../db/storage-backend';

/**
 * MemoryIndexerDatabase provides a simple in-memory implementation of IndexerDatabase
 * 
 * This is primarily useful for testing, development, and small-scale usage.
 * Production applications should implement a persistent database solution.
 */
export class MemoryIndexerDatabase implements IndexerDatabase {
  private backend: StorageBackend;
  private ttlMs: number | null;

  constructor(options: { backend?: StorageBackend; ttlMs?: number } = {}) {
    this.backend = options.backend ?? new InMemoryBackend();
    this.ttlMs = options.ttlMs ?? null;
  }

  private makeKey(type: string, id: string): string {
    return `${type}:${id}`;
  }

  private async getEntry<T>(key: string): Promise<T | null> {
    const entry = await this.backend.get<{ data: T; expiresAt: number | null }>(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.backend.set(key, null);
      return null;
    }
    return entry.data;
  }

  private async setEntry<T>(key: string, data: T): Promise<void> {
    const expiresAt = this.ttlMs ? Date.now() + this.ttlMs : null;
    await this.backend.set(key, { data, expiresAt });
  }
  
  /**
   * Get an inscription by its ID
   */
  async getInscription(id: string): Promise<IndexerInscription | null> {
    return this.getEntry<IndexerInscription>(this.makeKey('inscription', id));
  }
  
  /**
   * Store an inscription
   */
  async storeInscription(inscription: IndexerInscription): Promise<void> {
    await this.setEntry(this.makeKey('inscription', inscription.id), inscription);

    const satKey = this.makeKey('satoshi', inscription.satoshi);
    const ids = (await this.getEntry<string[]>(satKey)) || [];
    if (!ids.includes(inscription.id)) {
      ids.push(inscription.id);
      await this.setEntry(satKey, ids);
    }

    const allIds = (await this.getEntry<string[]>(this.makeKey('all', 'ids'))) || [];
    if (!allIds.includes(inscription.id)) {
      allIds.push(inscription.id);
      await this.setEntry(this.makeKey('all', 'ids'), allIds);
    }
  }
  
  /**
   * Get inscriptions associated with a satoshi
   */
  async getInscriptionsBySatoshi(satoshi: string): Promise<IndexerInscription[]> {
    const ids = (await this.getEntry<string[]>(this.makeKey('satoshi', satoshi))) || [];
    const results: IndexerInscription[] = [];
    for (const id of ids) {
      const ins = await this.getInscription(id);
      if (ins) results.push(ins);
    }
    return results;
  }
  
  /**
   * Get raw inscription content
   */
  async getInscriptionContent(id: string): Promise<Buffer | null> {
    return this.getEntry<Buffer>(this.makeKey('content', id));
  }
  
  /**
   * Store raw inscription content
   */
  async storeInscriptionContent(id: string, content: Buffer): Promise<void> {
    await this.setEntry(this.makeKey('content', id), content);
  }
  
  /**
   * Get decoded metadata for an inscription
   */
  async getInscriptionMetadata(id: string): Promise<any | null> {
    return this.getEntry<any>(this.makeKey('metadata', id));
  }
  
  /**
   * Store decoded metadata for an inscription
   */
  async storeInscriptionMetadata(id: string, metadata: any): Promise<void> {
    await this.setEntry(this.makeKey('metadata', id), metadata);
  }
  
  /**
   * Get the last synced block height
   */
  async getLastSyncedHeight(): Promise<number | null> {
    return this.getEntry<number>('lastSyncedHeight');
  }
  
  /**
   * Update the last synced block height
   */
  async setLastSyncedHeight(height: number): Promise<void> {
    await this.setEntry('lastSyncedHeight', height);
  }
  
  /**
   * Store a DID document
   */
  async storeDIDDocument(didId: string, document: any): Promise<void> {
    await this.setEntry(this.makeKey('did', didId), document);
  }
  
  /**
   * Store a verifiable credential
   */
  async storeCredential(inscriptionId: string, credential: any): Promise<void> {
    await this.setEntry(this.makeKey('credential', inscriptionId), credential);
  }
  
  /**
   * Get all stored inscriptions (for testing)
   */
  async getAllInscriptions(): Promise<IndexerInscription[]> {
    // naive implementation: rely on satoshi index
    const idsEntry = await this.backend.get<string[]>(this.makeKey('all', 'ids'));
    const ids = idsEntry || [];
    const res: IndexerInscription[] = [];
    for (const id of ids) {
      const ins = await this.getInscription(id);
      if (ins) res.push(ins);
    }
    return res;
  }
  
  /**
   * Get a DID document by ID (for testing)
   */
  async getDIDDocument(didId: string): Promise<any | null> {
    return this.getEntry<any>(this.makeKey('did', didId));
  }
  
  /**
   * Get a credential by inscription ID (for testing)
   */
  async getCredential(inscriptionId: string): Promise<any | null> {
    return this.getEntry<any>(this.makeKey('credential', inscriptionId));
  }
  
  /**
   * Clear all stored data (for testing)
   */
  async clearAll(): Promise<void> {
    await this.backend.clear();
  }
}
