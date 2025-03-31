import { describe, expect, it, beforeEach, mock } from 'bun:test';

// Mock the provider factory before importing ResourceResolver
const mockProvider = {
    async resolve(inscriptionId: string) {
        if (inscriptionId !== '1234567890i0') {
            throw new Error('Inscription not found');
        }
        return {
            id: 'did:btco:1234567890/0',
            type: 'test-type',
            inscriptionId: '1234567890i0',
            didReference: 'did:btco:1234567890',
            contentType: 'application/json',
            content: { value: { test: 'data' } },
            sat: 1234567890
        };
    },

    async resolveInfo(inscriptionId: string) {
        if (inscriptionId !== '1234567890i0') {
            throw new Error('Inscription not found');
        }
        return {
            id: 'did:btco:1234567890/0',
            type: 'test-type',
            contentType: 'application/json',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
        };
    },

    async resolveCollection() {
        return [{
            id: 'did:btco:1234567890/0',
            type: 'test-type',
            inscriptionId: '1234567890i0',
            didReference: 'did:btco:1234567890',
            contentType: 'application/json',
            content: { value: { test: 'data' } },
            sat: 1234567890
        }];
    }
};

mock.module('../src/resources/providers/provider-factory', () => ({
    ProviderFactory: {
        createProvider: (config: { type: string }) => {
            if (config.type === 'ordiscan' || config.type === 'ord') {
                return mockProvider;
            }
            throw new Error('Unsupported provider type');
        }
    },
    ProviderType: {
        ORDISCAN: 'ordiscan',
        ORD: 'ord'
    }
}));

import { ResourceResolver } from '../src/resources/resource-resolver';
import { ProviderType, ProviderConfig } from '../src/resources/providers/provider-factory';

describe('ResourceResolver', () => {
    describe('Ordiscan Provider', () => {
        const config: ProviderConfig = {
            type: ProviderType.ORDISCAN,
            options: {
                apiKey: 'test-key',
                apiEndpoint: 'https://api.ordiscan.com'
            }
        };

        const resolver = new ResourceResolver(config);

        it('should resolve a resource by ID', async () => {
            const result = await resolver.resolve('did:btco:1234567890/0');
            expect(result).toEqual({
                id: 'did:btco:1234567890/0',
                type: 'test-type',
                inscriptionId: '1234567890i0',
                didReference: 'did:btco:1234567890',
                contentType: 'application/json',
                content: { value: { test: 'data' } },
                sat: 1234567890
            });
        });

        it('should resolve resource info', async () => {
            const result = await resolver.resolveInfo('did:btco:1234567890/0');
            expect(result).toEqual({
                id: 'did:btco:1234567890/0',
                type: 'test-type',
                contentType: 'application/json',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
            });
        });

        it('should resolve a collection of resources', async () => {
            const result = await resolver.resolveCollection();
            expect(result).toEqual([{
                id: 'did:btco:1234567890/0',
                type: 'test-type',
                inscriptionId: '1234567890i0',
                didReference: 'did:btco:1234567890',
                contentType: 'application/json',
                content: { value: { test: 'data' } },
                sat: 1234567890
            }]);
        });

        it('should throw error for invalid resource ID', async () => {
            await expect(resolver.resolve('invalid-id'))
                .rejects
                .toThrow('Invalid resource identifier');
        });
    });

    describe('Ord Provider', () => {
        const config: ProviderConfig = {
            type: ProviderType.ORD,
            options: {
                nodeUrl: 'http://localhost:8080'
            }
        };

        const resolver = new ResourceResolver(config);

        it('should resolve a resource by ID', async () => {
            const result = await resolver.resolve('did:btco:1234567890/0');
            expect(result).toEqual({
                id: 'did:btco:1234567890/0',
                type: 'test-type',
                inscriptionId: '1234567890i0',
                didReference: 'did:btco:1234567890',
                contentType: 'application/json',
                content: { value: { test: 'data' } },
                sat: 1234567890
            });
        });

        it('should resolve resource info', async () => {
            const result = await resolver.resolveInfo('did:btco:1234567890/0');
            expect(result).toEqual({
                id: 'did:btco:1234567890/0',
                type: 'test-type',
                contentType: 'application/json',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z'
            });
        });

        it('should resolve a collection of resources', async () => {
            const result = await resolver.resolveCollection();
            expect(result).toEqual([{
                id: 'did:btco:1234567890/0',
                type: 'test-type',
                inscriptionId: '1234567890i0',
                didReference: 'did:btco:1234567890',
                contentType: 'application/json',
                content: { value: { test: 'data' } },
                sat: 1234567890
            }]);
        });

        it('should throw error for invalid resource ID', async () => {
            await expect(resolver.resolve('invalid-id'))
                .rejects
                .toThrow('Invalid resource identifier');
        });
    });

    describe('Provider Factory', () => {
        it('should create an Ordiscan provider', () => {
            const config: ProviderConfig = {
                type: ProviderType.ORDISCAN,
                options: {
                    apiKey: 'test-key',
                    apiEndpoint: 'https://api.ordiscan.com'
                }
            };
            const resolver = new ResourceResolver(config);
            expect(resolver).toBeDefined();
        });

        it('should create an Ord provider', () => {
            const config: ProviderConfig = {
                type: ProviderType.ORD,
                options: {
                    nodeUrl: 'http://localhost:8080'
                }
            };
            const resolver = new ResourceResolver(config);
            expect(resolver).toBeDefined();
        });

        it('should throw error for unsupported provider type', () => {
            const config = {
                type: 'UNSUPPORTED' as ProviderType,
                options: {
                    apiKey: 'test-key',
                    apiEndpoint: 'https://api.ordiscan.com'
                }
            };
            expect(() => new ResourceResolver(config))
                .toThrow('Unsupported provider type');
        });
    });
}); 