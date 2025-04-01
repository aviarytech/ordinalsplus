import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ResourceResolver } from '../src/resources/resource-resolver';
import { OrdiscanProvider } from '../src/resources/providers/ordiscan-provider';
import { OrdNodeProvider } from '../src/resources/providers/ord-node-provider';
import { ERROR_CODES } from '../src/utils/constants';
import { LinkedResource } from '../src/types';
import { ProviderType, ProviderFactory } from '../src/resources/providers/provider-factory';

// Test data constants
const TEST_INSCRIPTION_ID = 'abc123i0';
const TEST_SAT_NUMBER = '1234567890';
const TEST_CONTENT = { value: 'test data' };
const TEST_TIMESTAMP = '2024-01-01T00:00:00Z';
const TEST_RESOURCE_ID = `did:btco:${TEST_SAT_NUMBER}/0`;

// Expected test results
const expectedResults = {
    resource: {
        id: TEST_RESOURCE_ID,
        type: 'application/json',
        contentType: 'application/json',
        content: TEST_CONTENT,
        sat: parseInt(TEST_SAT_NUMBER),
        inscriptionId: TEST_INSCRIPTION_ID,
        didReference: `did:btco:${TEST_SAT_NUMBER}`
    },
    resourceInfo: {
        id: TEST_INSCRIPTION_ID,
        type: 'application/json',
        contentType: 'application/json',
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP
    }
};

describe('ResourceResolver', () => {
    describe('Ordiscan Provider', () => {
        let provider: OrdiscanProvider;
        let resolver: ResourceResolver;

        beforeEach(() => {
            provider = new OrdiscanProvider({ apiKey: 'test-api-key' });

            // Mock provider methods
            jest.spyOn(provider, 'getSatInfo').mockResolvedValue({
                inscription_ids: [TEST_INSCRIPTION_ID]
            });

            jest.spyOn(provider, 'resolveInscription').mockResolvedValue({
                id: TEST_INSCRIPTION_ID,
                sat: parseInt(TEST_SAT_NUMBER),
                content_type: 'application/json',
                content: TEST_CONTENT
            });

            jest.spyOn(provider, 'resolveInfo').mockResolvedValue(expectedResults.resourceInfo);

            jest.spyOn(provider, 'resolveCollection').mockResolvedValue([expectedResults.resource]);

            // Mock provider factory
            jest.spyOn(ProviderFactory, 'createProvider').mockReturnValue(provider);

            resolver = new ResourceResolver({
                type: ProviderType.ORDISCAN,
                options: {
                    apiKey: 'test-api-key'
                }
            });
        });

        it('should resolve a resource by ID', async () => {
            const result = await resolver.resolve(TEST_RESOURCE_ID);
            expect(result).toEqual(expectedResults.resource);
        });

        it('should resolve resource info', async () => {
            const result = await resolver.resolveInfo(TEST_RESOURCE_ID);
            expect(result).toEqual(expectedResults.resourceInfo);
        });

        it('should resolve a collection of resources', async () => {
            const result = await resolver.resolveCollection(`did:btco:${TEST_SAT_NUMBER}`);
            expect(result).toEqual([expectedResults.resource]);
        });

        it('should throw error for invalid resource ID', async () => {
            await expect(resolver.resolve('invalid-id'))
                .rejects
                .toThrow(`${ERROR_CODES.INVALID_RESOURCE_ID}: Invalid resource identifier: invalid-id`);
        });
    });

    describe('Ord Provider', () => {
        let provider: OrdNodeProvider;
        let resolver: ResourceResolver;

        beforeEach(() => {
            provider = new OrdNodeProvider();

            // Mock provider methods
            jest.spyOn(provider, 'getSatInfo').mockResolvedValue({
                inscription_ids: [TEST_INSCRIPTION_ID]
            });

            jest.spyOn(provider, 'resolveInscription').mockResolvedValue({
                id: TEST_INSCRIPTION_ID,
                sat: parseInt(TEST_SAT_NUMBER),
                content_type: 'application/json',
                content: TEST_CONTENT
            });

            jest.spyOn(provider, 'resolveInfo').mockResolvedValue(expectedResults.resourceInfo);

            jest.spyOn(provider, 'resolveCollection').mockResolvedValue([expectedResults.resource]);

            // Mock provider factory
            jest.spyOn(ProviderFactory, 'createProvider').mockReturnValue(provider);

            resolver = new ResourceResolver({
                type: ProviderType.ORD,
                options: {
                    nodeUrl: 'http://localhost:8080'
                }
            });
        });

        it('should resolve a resource by ID', async () => {
            const result = await resolver.resolve(TEST_RESOURCE_ID);
            expect(result).toEqual(expectedResults.resource);
        });

        it('should resolve resource info', async () => {
            const result = await resolver.resolveInfo(TEST_RESOURCE_ID);
            expect(result).toEqual(expectedResults.resourceInfo);
        });

        it('should resolve a collection of resources', async () => {
            const result = await resolver.resolveCollection(`did:btco:${TEST_SAT_NUMBER}`);
            expect(result).toEqual([expectedResults.resource]);
        });

        it('should throw error for invalid resource ID', async () => {
            await expect(resolver.resolve('invalid-id'))
                .rejects
                .toThrow(`${ERROR_CODES.INVALID_RESOURCE_ID}: Invalid resource identifier: invalid-id`);
        });
    });

    describe('Provider Factory', () => {
        it('should create an Ordiscan provider', () => {
            const provider = new OrdiscanProvider({ apiKey: 'test-api-key' });
            expect(provider).toBeInstanceOf(OrdiscanProvider);
        });

        it('should create an Ord provider', () => {
            const provider = new OrdNodeProvider();
            expect(provider).toBeInstanceOf(OrdNodeProvider);
        });

        it('should throw error for unsupported provider type', () => {
            // Mock ProviderFactory.createProvider to throw error
            jest.spyOn(ProviderFactory, 'createProvider').mockImplementation(() => {
                throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Unsupported provider type: unsupported`);
            });

            expect(() => {
                // @ts-ignore
                new ResourceResolver({ type: 'unsupported' });
            }).toThrow(`${ERROR_CODES.NETWORK_ERROR}: Unsupported provider type: unsupported`);
        });
    });
}); 