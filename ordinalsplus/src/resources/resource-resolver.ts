import { ERROR_CODES } from '../utils/constants';
import { Inscription, LinkedResource, ResourceInfo } from '../types';
import { isValidResourceId, parseResourceId } from '../utils/validators';
import { ProviderFactory, ProviderConfig, ProviderType } from './providers/provider-factory';
import { ResourceProvider } from './providers/types';
import { createLinkedResourceFromInscription } from '../did/did-utils';

export interface ResourceResolverOptions {
    apiEndpoint?: string;
    apiKey?: string;
    timeout?: number;
}

export class ResourceResolver {
    private readonly apiEndpoint: string;
    private readonly timeout: number;
    private readonly provider: ResourceProvider;

    constructor(options: ResourceResolverOptions = {}) {
        const config: ProviderConfig = {
            type: ProviderType.ORDISCAN,
            options: {
                apiKey: process.env.ORDISCAN_API_KEY || '',
                apiEndpoint: options.apiEndpoint,
                timeout: options.timeout
            }
        };
        this.provider = ProviderFactory.createProvider(config);
        this.apiEndpoint = options.apiEndpoint || 'https://api.ordinalsplus.com';
        this.timeout = options.timeout || 5000;
    }

    private getProviderForDid(did: string): ResourceProvider {
        // For now, we'll use the same provider for all DIDs
        // In the future, we might want to select different providers based on the DID
        return this.provider;
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
            return createLinkedResourceFromInscription(inscription, inscription.content_type || 'Unknown');
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource`);
        }
    }

    async resolveInfo(resourceId: string): Promise<ResourceInfo> {
        const parsed = parseResourceId(resourceId);
        if (!parsed) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: Could not parse resource identifier`);
        }

        const provider = this.getProviderForDid(parsed.did);
        const satInfo = await provider.getSatInfo(parsed.satNumber);
        if (satInfo.inscription_ids.length === 0) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: No inscription found at index ${parsed.index}`);
        }

        const inscriptionId = satInfo.inscription_ids[parsed.index];
        const inscription = await provider.resolveInscription(inscriptionId);

        return {
            id: resourceId,
            type: inscription.content_type || 'Unknown',
            contentType: inscription.content_type || 'Unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            content_url: inscription.content_url,
            inscriptionId: inscriptionId,
            didReference: parsed.did,
            sat: inscription.sat
        };
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

    private async resolveFromProvider(provider: ResourceProvider, inscription: Inscription): Promise<ResourceInfo> {
        const resource = createLinkedResourceFromInscription(inscription, 'resource');
        return {
            id: resource.id,
            type: resource.type,
            contentType: resource.contentType,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            content_url: resource.content_url,
            inscriptionId: resource.inscriptionId,
            didReference: resource.didReference,
            sat: resource.sat
        };
    }
} 