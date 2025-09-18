import { Inscription, LinkedResource, ResourceInfo } from '../../types';
import { ResourceProvider, ResourceCrawlOptions, InscriptionRefWithLocation } from './types';

/**
 * Static inscription data for the StaticDataProvider
 */
export interface StaticInscriptionData {
  inscriptionId: string;
  content: string;
  metadata?: any;
  contentUrl?: string;
}

/**
 * Static sat data for the StaticDataProvider
 */
export interface StaticSatData {
  satNumber: string;
  inscriptions: StaticInscriptionData[];
}

/**
 * Provider that serves pre-fetched/static data instead of making API calls.
 * Useful for testing, caching, or when data is already available.
 */
export class StaticDataProvider implements ResourceProvider {
  private satData: Map<string, StaticSatData> = new Map();
  private inscriptionData: Map<string, StaticInscriptionData> = new Map();

  constructor(sats: StaticSatData[] = []) {
    this.loadSatData(sats);
  }

  /**
   * Load sat data into the provider
   */
  loadSatData(sats: StaticSatData[]): void {
    for (const sat of sats) {
      this.satData.set(sat.satNumber, sat);
      
      // Also index inscriptions for quick lookup
      for (const inscription of sat.inscriptions) {
        this.inscriptionData.set(inscription.inscriptionId, inscription);
      }
    }
  }

  getAddressOutputs(address: string): Promise<string[]> {
    throw new Error('StaticDataProvider: getAddressOutputs() not implemented - use for DID resolution only');
  }

  getOutputDetails(outpoint: string): Promise<{ value: number; script_pubkey: string; spent: boolean; inscriptions: string[] }> {
    throw new Error('StaticDataProvider: getOutputDetails() not implemented - use for DID resolution only');
  }

  /**
   * Add a single sat's data
   */
  addSatData(sat: StaticSatData): void {
    this.satData.set(sat.satNumber, sat);
    
    for (const inscription of sat.inscriptions) {
      this.inscriptionData.set(inscription.inscriptionId, inscription);
    }
  }

  /**
   * Get sat information including inscription IDs
   */
  async getSatInfo(satNumber: string): Promise<{ inscription_ids: string[] }> {
    const sat = this.satData.get(satNumber);
    if (!sat) {
      throw new Error(`No data available for sat ${satNumber}`);
    }

    return {
      inscription_ids: sat.inscriptions.map(i => i.inscriptionId)
    };
  }

  /**
   * Resolve inscription details
   */
  async resolveInscription(inscriptionId: string): Promise<Inscription> {
    const inscription = this.inscriptionData.get(inscriptionId);
    if (!inscription) {
      throw new Error(`No data available for inscription ${inscriptionId}`);
    }

    return {
      id: inscription.inscriptionId,
      content_url: inscription.contentUrl || `data:text/plain;charset=utf-8,${encodeURIComponent(inscription.content)}`,
      content_type: 'text/plain', // Could be enhanced to detect type
      sat: 0, // Not available in static data
      timestamp: Date.now(), // Static data doesn't have timestamps
      metadata: inscription.metadata ? new TextEncoder().encode(JSON.stringify(inscription.metadata)) : undefined
    };
  }

  /**
   * Get metadata for an inscription
   */
  async getMetadata(inscriptionId: string): Promise<any> {
    const inscription = this.inscriptionData.get(inscriptionId);
    if (!inscription) {
      throw new Error(`No data available for inscription ${inscriptionId}`);
    }

    return inscription.metadata || null;
  }

  // Stub implementations for methods not needed for DID resolution
  async resolve(resourceId: string): Promise<LinkedResource> {
    throw new Error('StaticDataProvider: resolve() not implemented - use for DID resolution only');
  }

  async resolveInfo(resourceId: string): Promise<ResourceInfo> {
    throw new Error('StaticDataProvider: resolveInfo() not implemented - use for DID resolution only');
  }

  async resolveCollection(did: string, options: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<LinkedResource[]> {
    throw new Error('StaticDataProvider: resolveCollection() not implemented - use for DID resolution only');
  }

  async *getAllResources(options?: ResourceCrawlOptions): AsyncGenerator<LinkedResource[]> {
    throw new Error('StaticDataProvider: getAllResources() not implemented - use for DID resolution only');
  }

  async getInscriptionLocationsByAddress(address: string): Promise<InscriptionRefWithLocation[]> {
    throw new Error('StaticDataProvider: getInscriptionLocationsByAddress() not implemented - use for DID resolution only');
  }

  /**
   * Get all resources in chronological order (oldest first)
   * For static data provider, this is the same as getAllResources
   */
  async* getAllResourcesChronological(options?: ResourceCrawlOptions): AsyncGenerator<LinkedResource[]> {
    // Delegate to the regular getAllResources method
    yield* this.getAllResources(options);
  }

  async getInscriptionByNumber(inscriptionNumber: number): Promise<Inscription> {
    // Static data provider doesn't have inscription numbers indexed
    throw new Error('StaticDataProvider: getInscriptionByNumber() not implemented - use for DID resolution only');
  }
} 