import { ERROR_CODES } from '../utils/constants';
import { Inscription, LinkedResource, ResourceInfo } from '../types';
import { isValidResourceId, parseResourceId } from '../utils/validators';
import { ProviderFactory, ProviderConfig } from './providers/provider-factory';
import { ResourceProvider } from './providers/types';

export interface ResourceResolverOptions {
    apiEndpoint?: string;
    timeout?: number;
}

export class ResourceResolver {
    private readonly apiEndpoint: string;
    private readonly timeout: number;
    private readonly provider: ResourceProvider;

    constructor(config: ProviderConfig, options: ResourceResolverOptions = {}) {
        this.provider = ProviderFactory.createProvider(config);
        this.apiEndpoint = options.apiEndpoint || 'https://api.ordinalsplus.com';
        this.timeout = options.timeout || 5000;
    }

    async resolve(resourceId: string): Promise<LinkedResource> {
        if (!isValidResourceId(resourceId)) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: Invalid resource identifier: ${resourceId}`);
        }

        try {
            const parsed = parseResourceId(resourceId);
            if (!parsed) {
                throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: Could not parse resource identifier`);
            }

            const satInfo = await this.provider.getSatInfo(parsed.satNumber);
            if (satInfo.inscription_ids.length === 0) {
                throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: No inscription found at index ${parsed.index}`);
            }

            const inscriptionId = satInfo.inscription_ids[parsed.index];
            const inscription = await this.provider.resolveInscription(inscriptionId);
            return {
                id: resourceId,
                type: inscription.content_type || 'Unknown',
                inscriptionId: inscriptionId,
                didReference: parsed.did,
                contentType: inscription.content_type || 'Unknown',
                content: inscription.content,
                sat: inscription.sat
            };
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource`);
        }
    }

    async resolveInfo(resourceId: string): Promise<ResourceInfo> {
        if (!isValidResourceId(resourceId)) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: Invalid resource identifier: ${resourceId}`);
        }

        try {
            const parsed = parseResourceId(resourceId);
            if (!parsed) {
                throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: Could not parse resource identifier`);
            }

            // First get the sat info to get inscription IDs
            const satInfo = await this.provider.getSatInfo(parsed.satNumber);
            const inscriptionId = satInfo.inscription_ids[parsed.index];
            if (!inscriptionId) {
                throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: No inscription found at index ${parsed.index}`);
            }

            // Get the resource info using the inscription ID
            return await this.provider.resolveInfo(inscriptionId);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource info`);
        }
    }

    async resolveCollection(did: string, options: {
        type?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<LinkedResource[]> {
        try {
            return await this.provider.resolveCollection(did, options);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve collection`);
        }
    }
} 