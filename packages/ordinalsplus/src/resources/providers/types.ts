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
    getInscriptionLocationsByAddress(address: string): Promise<InscriptionRefWithLocation[]>;
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