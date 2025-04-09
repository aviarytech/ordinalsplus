import { Inscription, LinkedResource, ResourceInfo } from '../../types';
import { ERROR_CODES } from '../../utils/constants';
import { extractIndexFromInscription, parseResourceId, parseBtcoDid } from '../../utils/validators';
import { fetchWithTimeout } from '../../utils/fetch-utils';
import { ResourceProvider, ResourceCrawlOptions, ResourceBatch } from './types';
import { createLinkedResourceFromInscription } from '../../did/did-utils';

export interface OrdiscanProviderOptions {
    apiKey: string;
    apiEndpoint?: string;
    timeout?: number;
}

export interface OrdiscanInscription {
    id: string;
    number: number;
    sat: number;
    content_type: string;
    content_url: string;
}

export interface OrdiscanApiResponse<T> {
    data: T;
}

interface OrdiscanInscriptionResponse {
    inscription_id: string;
    inscription_number: number;
    content_type: string;
    owner_address: string;
    owner_output: string;
    genesis_address: string;
    genesis_output: string;
    timestamp: string;
    sat: number;
    content_url: string;
}

export class OrdiscanProvider implements ResourceProvider {
    private readonly apiKey: string;
    private readonly apiEndpoint: string;
    private readonly timeout: number;
    private readonly baseUrl: string;
    private readonly batchSize: number;

    constructor(options: OrdiscanProviderOptions, baseUrl: string = 'https://ordiscan.com/api', batchSize: number = 100) {
        this.apiKey = options.apiKey;
        this.apiEndpoint = options.apiEndpoint || 'https://api.ordiscan.com/v1';
        this.timeout = options.timeout || 5000;
        this.baseUrl = baseUrl;
        this.batchSize = batchSize;
    }

    protected async fetchApi<T>(endpoint: string): Promise<OrdiscanApiResponse<T>> {
        const response = await fetchWithTimeout<OrdiscanApiResponse<T>>(
            `${this.apiEndpoint}${endpoint}`,
            {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                timeout: this.timeout
            }
        );
        return response.data;
    }

    async getSatInfo(satNumber: string): Promise<{ inscription_ids: string[] }> {
        const response = await this.fetchApi<{ inscription_ids: string[] }>(`/sat/${satNumber}`);
        return { inscription_ids: response.data.inscription_ids };
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
        const response = await this.fetchApi<OrdiscanInscriptionResponse>(`/inscription/${inscriptionId}`);
        return {
            id: response.data.inscription_id,
            sat: response.data.sat,
            content_type: response.data.content_type,
            content_url: response.data.content_url
        };
    }

    async resolveInfo(inscriptionId: string): Promise<ResourceInfo> {
        const response = await this.fetchApi<OrdiscanInscriptionResponse>(`/inscription/${inscriptionId}`);
        return {
            id: response.data.inscription_id,
            type: response.data.content_type,
            contentType: response.data.content_type,
            createdAt: response.data.timestamp,
            updatedAt: response.data.timestamp,
            content_url: response.data.content_url
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
        const contentType = inscription.content_type || 'application/json';
        return {
            id: `did:btco:${inscription.sat}/${extractIndexFromInscription(inscription)}`,
            type: contentType,
            contentType: contentType,
            content_url: inscription.content_url,
            sat: inscription.sat,
            inscriptionId: inscription.id,
            inscriptionNumber: inscription.number,
            didReference: `did:btco:${inscription.sat}`
        };
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
        // Calculate the after parameter based on the cursor
        // Since we're using inscription_number_desc, we need to track the last inscription number
        const after = cursor > 0 ? cursor : undefined;
        
        // Build the query parameters
        const params = new URLSearchParams({
            sort: 'inscription_number_desc',
            limit: size.toString()
        });
        
        if (after) {
            params.append('after', after.toString());
        }

        const response = await this.fetchApi<{ data: OrdiscanInscriptionResponse[] }>(`/inscriptions?${params.toString()}`);

        if (!response.data || !Array.isArray(response.data)) {
            return {
                resources: [],
                hasMore: false
            };
        }

        const resources = response.data.map(inscription => {
            const inscriptionObj = {
                id: inscription.inscription_id,
                number: inscription.inscription_number,
                sat: inscription.sat,
                content_type: inscription.content_type,
                content_url: inscription.content_url
            };
            return createLinkedResourceFromInscription(inscriptionObj, inscription.content_type);
        });

        // Check if there are more resources by looking at the last inscription number
        const hasMore = resources.length === size;
        const nextCursor = hasMore ? resources[resources.length - 1].inscriptionNumber : undefined;

        return {
            resources,
            nextCursor,
            hasMore
        };
    }

    async getInscription(inscriptionId: string): Promise<Inscription> {
        const response = await this.fetchApi<OrdiscanInscriptionResponse>(`/inscription/${inscriptionId}`);
        return {
            id: response.data.inscription_id,
            sat: response.data.sat,
            content_type: response.data.content_type,
            content_url: response.data.content_url
        };
    }

    async getInscriptionsByAddress(address: string): Promise<Inscription[]> {
        const response = await this.fetchApi<{ inscriptions: OrdiscanInscriptionResponse[] }>(`/address/${address}/inscriptions`);
        return response.data.inscriptions.map(inscription => ({
            id: inscription.inscription_id,
            sat: inscription.sat,
            content_type: inscription.content_type,
            content_url: inscription.content_url
        }));
    }
} 