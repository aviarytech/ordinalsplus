import { ResourceApiProvider } from '../resource-resolver';
import { Inscription, LinkedResource, ResourceInfo } from '../../types';
import { ERROR_CODES } from '../../utils/constants';
import { extractIndexFromInscription, parseResourceId, parseBtcoDid } from '../../utils/validators';
import { fetchWithTimeout } from '../../utils/fetch-utils';

export interface OrdiscanProviderOptions {
    apiKey: string;
    apiEndpoint?: string;
    timeout?: number;
}

export interface OrdiscanApiResponse<T> {
    data: {
        data: T;
    };
}

export class OrdiscanProvider implements ResourceApiProvider {
    private readonly apiKey: string;
    private readonly apiEndpoint: string;
    private readonly timeout: number;

    constructor(options: OrdiscanProviderOptions) {
        this.apiKey = options.apiKey;
        this.apiEndpoint = options.apiEndpoint || 'https://api.ordiscan.com/v1';
        this.timeout = options.timeout || 5000;
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
        return { inscription_ids: response.data.data.inscription_ids };
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
        const response = await this.fetchApi<{
            inscription_id: string;
            sat: number;
            content_type: string;
            content: any;
        }>(`/inscription/${inscriptionId}`);

        return {
            id: response.data.data.inscription_id,
            sat: response.data.data.sat,
            content_type: response.data.data.content_type,
            content: response.data.data.content
        };
    }

    async resolveInfo(inscriptionId: string): Promise<ResourceInfo> {
        const response = await this.fetchApi<{
            inscription_id: string;
            content_type: string;
            timestamp: string;
        }>(`/inscription/${inscriptionId}`);

        return {
            id: response.data.data.inscription_id,
            type: response.data.data.content_type,
            contentType: response.data.data.content_type,
            createdAt: response.data.data.timestamp,
            updatedAt: response.data.data.timestamp
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
            content: inscription.content,
            sat: inscription.sat,
            inscriptionId: inscription.id,
            didReference: `did:btco:${inscription.sat}`
        };
    }
} 