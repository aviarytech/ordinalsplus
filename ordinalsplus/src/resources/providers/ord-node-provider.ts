import { ResourceApiProvider } from '../resource-resolver';
import { LinkedResource, ResourceInfo } from '../../types';
import { ERROR_CODES } from '../../utils/constants';
import { extractIndexFromInscription, parseBtcoDid, parseResourceId } from '../../utils/validators';

export interface OrdNodeProviderOptions {
    nodeUrl: string;
    timeout?: number;
}

export class OrdNodeProvider implements ResourceApiProvider {
    private readonly nodeUrl: string;
    private readonly timeout: number;

    constructor(options: OrdNodeProviderOptions) {
        this.nodeUrl = options.nodeUrl;
        this.timeout = options.timeout || 5000;
    }

    async resolve(resourceId: string): Promise<LinkedResource> {
        try {
            const response = await fetch(`${this.nodeUrl}/inscription/${resourceId}`, {
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Ord node returned ${response.status}`);
            }

            const data = await response.json();
            return this.transformInscriptionToResource(data);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource from Ord node`);
        }
    }

    async resolveInfo(resourceId: string): Promise<ResourceInfo> {
        try {
            const response = await fetch(`${this.nodeUrl}/inscription/${resourceId}/info`, {
                headers: {
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            if (!response.ok) {
                throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Ord node returned ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource info from Ord node`);
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
                `${this.nodeUrl}/inscriptions?limit=${limit}&offset=${offset}`,
                {
                    headers: {
                        'Accept': 'application/json'
                    },
                    signal: AbortSignal.timeout(this.timeout)
                }
            );

            if (!response.ok) {
                throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Ord node returned ${response.status}`);
            }

            const data = await response.json();
            return data.inscriptions.map((inscription: any) => this.transformInscriptionToResource(inscription));
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve collection from Ord node`);
        }
    }

    private transformInscriptionToResource(inscription: any): LinkedResource {
        return {
            inscriptionId: inscription.id,
            contentType: inscription.content_type,
            content: inscription.content,
            sat: inscription.sat,
            id: `did:btco:${inscription.sat}/${extractIndexFromInscription(inscription)}`,
            type: inscription.content_type,
            didReference: `did:btco:${inscription.sat}`
        };
    }
} 