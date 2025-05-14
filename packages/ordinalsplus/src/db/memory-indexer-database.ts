import { IndexerInscription, IndexerDatabase } from "../types/indexer";
import { DidDocument as DIDDocument } from "../types/did"; // Aliasing to match usage

// Using any for these types for now as their specific interfaces are not immediately found
// or are defined as 'any' in the IndexerDatabase interface.
type VerifiableCredential = any;
type Satpoint = any;

interface CacheEntry<T> {
  data: T;
  expiresAt: number | null; // null means never expires
}

export class MemoryIndexerDatabase implements IndexerDatabase {
  private inscriptions: Map<string, CacheEntry<IndexerInscription>> = new Map();
  private inscriptionContent: Map<string, CacheEntry<Buffer>> = new Map();
  private inscriptionMetadata: Map<string, CacheEntry<any>> = new Map();
  private didDocuments: Map<string, CacheEntry<DIDDocument>> = new Map();
  private credentials: Map<string, CacheEntry<VerifiableCredential>> = new Map();
  private satpoints: Map<string, CacheEntry<Satpoint>> = new Map();
  private satoshiInscriptions: Map<string, CacheEntry<string[]>> = new Map(); // satoshi -> inscription_id[]
  private lastSyncedHeight: CacheEntry<number> | null = null;

  private readonly ttlMs: number | null;

  constructor(ttlMs?: number) {
    this.ttlMs = ttlMs ?? null;
  }

  private getCacheEntry<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = map.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      map.delete(key); // Cache expired, delete it
      return null;
    }
    return entry.data;
  }

  private setCacheEntry<T>(map: Map<string, CacheEntry<T>>, key: string, data: T): void {
    const expiresAt = this.ttlMs ? Date.now() + this.ttlMs : null;
    map.set(key, { data, expiresAt });
  }

  async storeInscription(inscription: IndexerInscription): Promise<void> {
    this.setCacheEntry(this.inscriptions, inscription.id, inscription);
    // Also update the satoshi to inscription mapping
    const satKey = `satoshi:${inscription.satoshi}`; // Use satoshi from IndexerInscription
    const existingSatoshiEntry = this.satoshiInscriptions.get(satKey);
    
    let inscriptionIds: string[] = [];
    if (existingSatoshiEntry) {
      if (existingSatoshiEntry.expiresAt === null || Date.now() <= existingSatoshiEntry.expiresAt) {
        inscriptionIds = [...existingSatoshiEntry.data];
      }
    }

    if (!inscriptionIds.includes(inscription.id)) {
      inscriptionIds.push(inscription.id);
    }
    this.setCacheEntry(this.satoshiInscriptions, satKey, inscriptionIds);
  }

  async getInscription(id: string): Promise<IndexerInscription | null> {
    return this.getCacheEntry(this.inscriptions, id);
  }

  async getInscriptionsBySatoshi(satoshi: string): Promise<IndexerInscription[]> {
    const satKey = `satoshi:${satoshi}`;
    const inscriptionIds = this.getCacheEntry(this.satoshiInscriptions, satKey);
    if (!inscriptionIds) {
      return [];
    }
    const inscriptionsToReturn: IndexerInscription[] = [];
    for (const id of inscriptionIds) {
      const inscription = await this.getInscription(id);
      if (inscription) { // Check if inscription is not null (i.e., not expired or not found)
        inscriptionsToReturn.push(inscription);
      }
    }
    return inscriptionsToReturn;
  }

  async storeInscriptionContent(
    inscriptionId: string,
    content: Buffer,
  ): Promise<void> {
    this.setCacheEntry(this.inscriptionContent, inscriptionId, content);
  }

  async getInscriptionContent(inscriptionId: string): Promise<Buffer | null> {
    return this.getCacheEntry(this.inscriptionContent, inscriptionId);
  }

  async storeInscriptionMetadata(
    inscriptionId: string,
    metadata: any,
  ): Promise<void> {
    this.setCacheEntry(this.inscriptionMetadata, inscriptionId, metadata);
  }

  async getInscriptionMetadata(inscriptionId: string): Promise<any | null> {
    return this.getCacheEntry(this.inscriptionMetadata, inscriptionId);
  }

  async storeDIDDocument(
    did: string, // Parameter name in IndexerDatabase is didId, but usage is 'did'
    document: DIDDocument,
  ): Promise<void> {
    this.setCacheEntry(this.didDocuments, did, document);
  }

  async getDIDDocument(did: string): Promise<DIDDocument | null> {
    return this.getCacheEntry(this.didDocuments, did);
  }

  async storeCredential(
    inscriptionId: string,
    credential: VerifiableCredential,
  ): Promise<void> {
    this.setCacheEntry(this.credentials, inscriptionId, credential);
  }

  async getCredential(
    inscriptionId: string,
  ): Promise<VerifiableCredential | null> {
    return this.getCacheEntry(this.credentials, inscriptionId);
  }

  async storeSatpoint(satoshi: string, satpoint: Satpoint): Promise<void> {
    this.setCacheEntry(this.satpoints, satoshi, satpoint);
  }

  async getSatpoint(satoshi: string): Promise<Satpoint | null> {
    return this.getCacheEntry(this.satpoints, satoshi);
  }

  async setLastSyncedHeight(height: number): Promise<void> {
    const expiresAt = this.ttlMs ? Date.now() + this.ttlMs : null;
    this.lastSyncedHeight = { data: height, expiresAt };
  }

  async getLastSyncedHeight(): Promise<number | null> {
    if (!this.lastSyncedHeight) {
      return null;
    }
    if (this.lastSyncedHeight.expiresAt !== null && Date.now() > this.lastSyncedHeight.expiresAt) {
      this.lastSyncedHeight = null;
      return null;
    }
    return this.lastSyncedHeight.data;
  }

  async clear(): Promise<void> {
    this.inscriptions.clear();
    this.inscriptionContent.clear();
    this.inscriptionMetadata.clear();
    this.didDocuments.clear();
    this.credentials.clear();
    this.satpoints.clear();
    this.satoshiInscriptions.clear();
    this.lastSyncedHeight = null;
  }
} 