import { ResourceApiProvider } from '../resource-resolver';
import { LinkedResource, ResourceInfo } from '../../types';
import { ERROR_CODES } from '../../utils/constants';
import { extractIndexFromInscription } from '../../utils/validators';

export interface OrdiscanProviderOptions {
    apiKey: string;
    apiEndpoint?: string;
    timeout?: number;
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

    async resolve(resourceId: string): Promise<LinkedResource> {
        try {
            const response = await fetch(`${this.apiEndpoint}/inscription/${resourceId}`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Ordiscan API returned ${response.status}`);
            }

            const data = await response.json();
            return this.transformInscriptionToResource(data);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource from Ordiscan`);
        }
    }

    async resolveInfo(resourceId: string): Promise<ResourceInfo> {
        try {
            const response = await fetch(`${this.apiEndpoint}/inscription/${resourceId}/info`, {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Ordiscan API returned ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource info from Ordiscan`);
        }
    }

    async resolveCollection(options: {
        type?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<LinkedResource[]> {
        try {
            const { limit = 20, offset = 0 } = options;
            const response = await fetch(
                `${this.apiEndpoint}/inscriptions?limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': `Bearer ${this.apiKey}`
                    },
                    signal: AbortSignal.timeout(this.timeout)
                }
            );

            if (!response.ok) {
                throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Ordiscan API returned ${response.status}`);
            }

            const data = await response.json();
            return data.inscriptions.map((inscription: any) => this.transformInscriptionToResource(inscription));
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve collection from Ordiscan`);
        }
    }

    private transformInscriptionToResource(inscription: any): LinkedResource {
        return {
            id: `did:btco:${inscription.sat}/${extractIndexFromInscription(inscription)}`,
            type: inscription.content_type,
            contentType: inscription.content_type,
            content: inscription.content,
            sat: inscription.sat,
            inscriptionId: inscription.id,
            didReference: `did:btco:${inscription.sat}`
        };
    }
} 