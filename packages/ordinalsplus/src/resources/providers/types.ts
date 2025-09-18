import { Inscription, LinkedResource, ResourceInfo } from '../../types';

export interface ResourceProvider {
    resolve(resourceId: string): Promise<LinkedResource>;
    resolveInscription(inscriptionId: string): Promise<Inscription>;
    resolveInfo(resourceId: string): Promise<ResourceInfo>;
    resolveCollection(did: string, options: {
        type?: string;
        limit?: number;
        offset?: number;
    }): Promise<LinkedResource[]>;
    getSatInfo(satNumber: string): Promise<{ inscription_ids: string[] }>;
    getMetadata(inscriptionId: string): Promise<any>;
    getAllResources(options?: ResourceCrawlOptions): AsyncGenerator<LinkedResource[]>;
    getAllResourcesChronological(options?: ResourceCrawlOptions): AsyncGenerator<LinkedResource[]>;
    getInscriptionLocationsByAddress(address: string): Promise<InscriptionRefWithLocation[]>;
    getInscriptionByNumber(inscriptionNumber: number): Promise<Inscription>;
    getAddressOutputs(address: string): Promise<string[]>;
    getOutputDetails(outpoint: string): Promise<{ value: number; script_pubkey: string; spent: boolean; inscriptions: string[] }>;
}

export interface ResourceCrawlOptions {
    batchSize?: number;
    startFrom?: number;
    maxResources?: number;
    filter?: (resource: LinkedResource) => boolean;
}

export interface ResourceBatch {
    resources: LinkedResource[];
    nextCursor?: number;
    hasMore: boolean;
}

export interface InscriptionRefWithLocation {
    id: string;
    location: string; // Represents txid:vout (e.g., from owner_output)
} 