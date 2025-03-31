import { ERROR_CODES } from '../utils/constants';
import { LinkedResource, ResourceInfo } from '../types';
import { isValidResourceId, parseResourceId } from '../utils/validators';
import { ProviderFactory, ProviderConfig } from './providers/provider-factory';

export interface ResourceResolverOptions {
    apiEndpoint?: string;
    timeout?: number;
}

export interface ResourceApiProvider {
    resolve(inscriptionId: string): Promise<LinkedResource>;
    resolveInfo(inscriptionId: string): Promise<ResourceInfo>;
    resolveCollection(options: {
        type?: string;
        limit?: number;
        offset?: number;
    }): Promise<LinkedResource[]>;
}

export class ResourceResolver {
    private readonly apiEndpoint: string;
    private readonly timeout: number;
    private readonly provider: ResourceApiProvider;

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
            const inscriptionId = `${parsed.satNumber}i${parsed.index}`;
            return await this.provider.resolve(inscriptionId);
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
            const inscriptionId = `${parsed.satNumber}i${parsed.index}`;
            return await this.provider.resolveInfo(inscriptionId);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve resource info`);
        }
    }

    async resolveCollection(options: {
        type?: string;
        limit?: number;
        offset?: number;
    } = {}): Promise<LinkedResource[]> {
        try {
            return await this.provider.resolveCollection(options);
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Failed to resolve collection`);
        }
    }
} 