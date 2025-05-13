import { ERROR_CODES } from '../utils/constants';
import { Inscription, LinkedResource, ResourceInfo, BitcoinNetwork } from '../types';
import { isValidResourceId, parseResourceId } from '../utils/validators';
import { ProviderFactory, ProviderConfig, ProviderType } from './providers/provider-factory';
import { ResourceProvider } from './providers/types';
import { createLinkedResourceFromInscription } from '../resources/linked-resource';
import { getDidPrefix } from '../did/did-utils';

export interface ResourceResolverOptions {
    apiEndpoint?: string;
    apiKey?: string;
    timeout?: number;
    network?: BitcoinNetwork;
}

export class ResourceResolver {
    private readonly apiEndpoint: string;
    private readonly timeout: number;
    private readonly provider: ResourceProvider;
    private readonly network: BitcoinNetwork;

    constructor(options: ResourceResolverOptions = {}) {
        this.network = options.network || 'mainnet';
        const config: ProviderConfig = {
            type: ProviderType.ORDISCAN,
            options: {
                apiKey: process.env.ORDISCAN_API_KEY || options.apiKey || '',
                apiEndpoint: options.apiEndpoint,
                timeout: options.timeout,
                network: this.network
            }
        };
        this.provider = ProviderFactory.createProvider(config);
        this.apiEndpoint = options.apiEndpoint || 'https://api.ordinalsplus.com';
        this.timeout = options.timeout || 5000;
    }

    private getProviderForDid(did: string): ResourceProvider {
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

            const provider = this.getProviderForDid(parsed.did);
            const satInfo = await provider.getSatInfo(parsed.satNumber);

            if (!satInfo || !satInfo.inscription_ids || satInfo.inscription_ids.length === 0 || satInfo.inscription_ids.length <= parsed.index) {
                throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: No inscription found at index ${parsed.index} for sat ${parsed.satNumber}`);
            }

            const inscriptionId = satInfo.inscription_ids[parsed.index];
            const inscription = await provider.resolveInscription(inscriptionId);
            
            return createLinkedResourceFromInscription(inscription, inscription.content_type || 'Unknown', this.network);
        } catch (error) {
            console.error(`[ResourceResolver] Error resolving ${resourceId}:`, error);
            if (error instanceof Error) {
                if (Object.values(ERROR_CODES).some(code => error.message.startsWith(code))) {
                    throw error;
                }
                throw new Error(`${ERROR_CODES.RESOLUTION_FAILED}: Failed to resolve resource: ${error.message}`);
            }
            throw new Error(`${ERROR_CODES.RESOLUTION_FAILED}: An unknown error occurred during resource resolution`);
        }
    }

    async resolveInfo(resourceId: string): Promise<ResourceInfo> {
        const parsed = parseResourceId(resourceId);
        if (!parsed) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: Could not parse resource identifier`);
        }

        const provider = this.getProviderForDid(parsed.did);
        const satInfo = await provider.getSatInfo(parsed.satNumber);
        if (!satInfo || !satInfo.inscription_ids || satInfo.inscription_ids.length === 0 || satInfo.inscription_ids.length <= parsed.index) {
            throw new Error(`${ERROR_CODES.INVALID_RESOURCE_ID}: No inscription found at index ${parsed.index} for sat ${parsed.satNumber}`);
        }

        const inscriptionId = satInfo.inscription_ids[parsed.index];
        const inscription = await provider.resolveInscription(inscriptionId);

        const didPrefix = getDidPrefix(this.network);
        const didReference = `${didPrefix}:${inscription.sat}`;

        return {
            id: resourceId,
            type: inscription.content_type || 'Unknown',
            contentType: inscription.content_type || 'Unknown',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            content_url: inscription.content_url,
            inscriptionId: inscriptionId,
            didReference: didReference,
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
            console.error(`[ResourceResolver] Error resolving collection for ${did}:`, error);
            if (error instanceof Error) {
                if (Object.values(ERROR_CODES).some(code => error.message.startsWith(code))) {
                    throw error;
                }
                throw new Error(`${ERROR_CODES.RESOLUTION_FAILED}: Failed to resolve collection: ${error.message}`);
            }
            throw new Error(`${ERROR_CODES.RESOLUTION_FAILED}: An unknown error occurred during collection resolution`);
        }
    }
} 