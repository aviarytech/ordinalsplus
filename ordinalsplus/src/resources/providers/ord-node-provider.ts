import { Inscription, LinkedResource, ResourceInfo, BitcoinNetwork } from '../../types';
import { ERROR_CODES } from '../../utils/constants';
import { parseResourceId, parseBtcoDid } from '../../utils/validators';
import { fetchWithTimeout } from '../../utils/fetch-utils';
import { createLinkedResourceFromInscription } from '../../resources/linked-resource';
import { ResourceProvider, ResourceCrawlOptions, ResourceBatch, InscriptionRefWithLocation } from './types';

export interface OrdNodeProviderOptions {
    nodeUrl: string;
    apiKey?: string;
    timeout?: number;
    network?: BitcoinNetwork;
}

export interface OrdNodeApiResponse<T> {
    [x: string]: any;
}

export interface OrdNodeInscription {
    id: string;
    number: number;
    sat: number;
    content_type: string;
    content_url: string;
}

interface OrdNodeInscriptionResponse {
    id: string;
    sat: number;
    content_type: string;
    content_url: string;
}

interface OrdNodeInscriptionListResponse {
    ids: string[];
    more: boolean;
    page_index: number;
}

interface OrdNodeFullInscriptionResponse {
    inscription_id: string;
    output?: string;
    address?: string;
    sat?: number;
    content_type?: string;
}

export class OrdNodeProvider implements ResourceProvider {
    private readonly nodeUrl: string;
    private readonly apiKey?: string;
    private readonly timeout: number;
    private readonly network: BitcoinNetwork;
    private readonly batchSize: number;

    constructor(options: OrdNodeProviderOptions, batchSize: number = 100) {
        this.nodeUrl = options.nodeUrl.endsWith('/') ? options.nodeUrl.slice(0, -1) : options.nodeUrl;
        this.apiKey = options.apiKey;
        this.timeout = options.timeout || 5000;
        this.network = options.network || 'mainnet';
        this.batchSize = batchSize;
        console.log('options', options)
    }

    protected async fetchApi<T>(endpoint: string): Promise<OrdNodeApiResponse<T>> {
        const response = await fetchWithTimeout<OrdNodeApiResponse<T>>(
            `${this.nodeUrl}${endpoint}`,
            {
                timeout: this.timeout,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            }
        );
        return response.data;
    }

    async getSatInfo(satNumber: string): Promise<{ inscription_ids: string[] }> {
        const response = await this.fetchApi<{ inscription_ids: string[] }>(`/sat/${satNumber}`);
        return { inscription_ids: response.inscription_ids };
    }

    async resolve(resourceId: string): Promise<LinkedResource> {
        const parsed = parseResourceId(resourceId);
        if (!parsed) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: Could not parse resource identifier`);
        }
        const satInfo = await this.getSatInfo(parsed.satNumber);
        if (satInfo.inscription_ids.length === 0) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: No inscription found at index ${parsed.index}`);
        }
        const inscriptionId = satInfo.inscription_ids[parsed.index];
        const inscription = await this.resolveInscription(inscriptionId);
        return this.transformInscriptionToResource(inscription);
    }

    async resolveInscription(inscriptionId: string): Promise<Inscription> {
        const response = await this.fetchApi<OrdNodeInscriptionResponse>(`/inscription/${inscriptionId}`);
        return {
            id: response.inscription_id,
            sat: response.sat,
            content_type: response.content_type,
            content_url: response.content_url
        };
    }

    async resolveInfo(inscriptionId: string): Promise<ResourceInfo> {
        const response = await this.fetchApi<OrdNodeInscriptionResponse>(`/inscription/${inscriptionId}`);
        return {
            id: response.inscription_id,
            type: response.content_type,
            contentType: response.content_type,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            content_url: response.content_url
        };
    }

    async resolveCollection(did: string, options: {
        type?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<LinkedResource[]> {
        try {
            const parsed = parseBtcoDid(did);
            if (!parsed) {
                throw new Error(`${ERROR_CODES.INVALID_DID}: Could not parse DID`);
            }

            const satInfo = await this.getSatInfo(parsed.satNumber);
            if (satInfo.inscription_ids.length === 0) {
                return [];
            }

            let inscriptionIds = satInfo.inscription_ids;
            if (options.offset !== undefined) {
                inscriptionIds = inscriptionIds.slice(options.offset);
            }
            if (options.limit !== undefined) {
                inscriptionIds = inscriptionIds.slice(0, options.limit);
            }

            const resources = await Promise.all(
                inscriptionIds.map(async (inscriptionId) => {
                    const inscription = await this.resolveInscription(inscriptionId);
                    const resource = this.transformInscriptionToResource(inscription);
                    
                    if (options.type && resource.type !== options.type) {
                        return null;
                    }
                    
                    return resource;
                })
            );

            return resources.filter((resource): resource is LinkedResource => resource !== null);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve collection`);
        }
    }

    transformInscriptionToResource(inscription: Inscription): LinkedResource {
        console.log('here444')
        return createLinkedResourceFromInscription(inscription, inscription.content_type || 'Unknown', this.network);
    }

    async *getAllResources(options: ResourceCrawlOptions = {}): AsyncGenerator<LinkedResource[]> {
        const {
            batchSize = this.batchSize,
            startFrom = 0,
            maxResources,
            filter
        } = options;

        let currentCursor = startFrom;
        let processedCount = 0;

        while (true) {
            if (maxResources && processedCount >= maxResources) {
                break;
            }

            const batch = await this.fetchResourceBatch(currentCursor, batchSize);
            
            if (!batch.resources.length) {
                break;
            }

            const filteredResources = filter
                ? batch.resources.filter(filter)
                : batch.resources;

            if (filteredResources.length > 0) {
                yield filteredResources;
                processedCount += filteredResources.length;
            }

            if (!batch.hasMore) {
                break;
            }

            currentCursor = batch.nextCursor || currentCursor + batchSize;
        }
    }

    private async fetchResourceBatch(cursor: number, size: number): Promise<ResourceBatch> {
        const page = Math.floor(cursor / size);
        const listResponse = await this.fetchApi<OrdNodeInscriptionListResponse>(`/inscriptions/${page}`);
        const resources = await Promise.all(
            listResponse.ids.map(async (id: string) => {
                const inscriptionResponse = await this.fetchApi<OrdNodeInscriptionResponse>(`/inscription/${id}`);
                
                console.log(inscriptionResponse)
                const inscriptionObj: Inscription = {
                    id: inscriptionResponse.id,
                    sat: inscriptionResponse.sat,
                    content_type: inscriptionResponse.content_type,
                    content_url: `${this.nodeUrl}/content/${inscriptionResponse.id}`
                };
                return createLinkedResourceFromInscription(inscriptionObj, inscriptionResponse.content_type || 'Unknown', this.network);
            })
        );

        return {
            resources,
            nextCursor: listResponse.more ? cursor + size : undefined,
            hasMore: listResponse.more
        };
    }

    async getInscription(inscriptionId: string): Promise<Inscription> {
        const response = await this.fetchApi<OrdNodeInscriptionResponse>(`/inscription/${inscriptionId}`);
        return {
            id: response.inscription_id,
            sat: response.sat,
            content_type: response.content_type,
            content_url: response.content_url
        };
    }

    async getInscriptionsByAddress(address: string): Promise<Inscription[]> {
        const response = await this.fetchApi<{ inscriptions: OrdNodeInscriptionResponse[] }>(`/address/${address}/inscriptions`);
        return response.inscriptions.map((inscription: OrdNodeInscriptionResponse) => ({
            id: inscription.id,
            sat: inscription.sat,
            content_type: inscription.content_type,
            content_url: inscription.content_url
        }));
    }

    async getInscriptionLocationsByAddress(address: string): Promise<InscriptionRefWithLocation[]> {
        if (!address) {
            console.warn('[OrdNodeProvider] getInscriptionLocationsByAddress called with empty address.');
            return [];
        }

        const idsEndpoint = `/address/${address}/inscription_ids`;
        let inscriptionIds: string[] = [];

        try {
            console.log(`[OrdNodeProvider] Fetching inscription IDs for address ${address} from endpoint: ${idsEndpoint}`);
            const idResponse = await this.fetchApi<{ ids: string[] }>(idsEndpoint); 
            if (idResponse?.ids && Array.isArray(idResponse.ids)) {
                inscriptionIds = idResponse.ids;
                console.log(`[OrdNodeProvider] Found ${inscriptionIds.length} potential inscription IDs for address ${address}.`);
            } else {
                console.warn(`[OrdNodeProvider] No inscription IDs found or unexpected format for address ${address} at ${idsEndpoint}.`);
                return [];
            }
        } catch (error) {
            console.error(`[OrdNodeProvider] Error fetching inscription IDs for address ${address} from ${idsEndpoint}:`, error);
            return [];
        }

        if (inscriptionIds.length === 0) {
            return [];
        }

        console.log(`[OrdNodeProvider] Fetching full details for ${inscriptionIds.length} inscriptions...`);
        const locationPromises = inscriptionIds.map(async (id): Promise<InscriptionRefWithLocation | null> => {
            try {
                const detailResponse = await this.fetchApi<OrdNodeFullInscriptionResponse>(`/inscription/${id}`);
                
                const location = detailResponse?.output;
                if (location) {
                    return { id, location };
                } else {
                    console.warn(`[OrdNodeProvider] Location (output field) not found for inscription ${id}.`);
                    return null;
                }
            } catch (detailError) {
                console.error(`[OrdNodeProvider] Error fetching details for inscription ${id}:`, detailError);
                return null;
            }
        });

        const results = await Promise.all(locationPromises);
        return results.filter((item: InscriptionRefWithLocation | null): item is InscriptionRefWithLocation => item !== null);
    }
} 