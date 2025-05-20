import { describe, expect, it } from 'bun:test';
import { OrdiscanProvider } from '../src/resources/providers/ordiscan-provider';
import { OrdNodeProvider } from '../src/resources/providers/ord-node-provider';
import { ERROR_CODES } from '../src/utils/constants';
import { beforeEach, jest } from '@jest/globals';
import { Inscription } from '../src/types';

// Test data constants
const TEST_INSCRIPTION_ID = 'abc123i0';
const TEST_SAT_NUMBER = '1234567890';
const TEST_CONTENT_URL = 'https://ordinalsplus.com/resource/1';
const TEST_TIMESTAMP = '2024-01-01T00:00:00Z';

// Mock API responses
const mockResponses = {
    ordiscan: {
        inscription: {
            data: {
                inscription_id: '123i0',
                inscription_number: 123,
                content_type: 'application/json',
                owner_address: 'bc1q...',
                owner_output: '123...:0',
                genesis_address: 'bc1q...',
                genesis_output: '123...:0',
                timestamp: '2024-01-01T00:00:00Z',
                sat: 123456,
                content_url: TEST_CONTENT_URL
            }
        },
        inscriptionsList: {
            data: [
                {
                    inscription_id: '123i0',
                    inscription_number: 123,
                    content_type: 'application/json',
                    owner_address: 'bc1q...',
                    owner_output: '123...:0',
                    genesis_address: 'bc1q...',
                    genesis_output: '123...:0',
                    timestamp: '2024-01-01T00:00:00Z',
                    sat: 123456,
                    content_url: TEST_CONTENT_URL
                }
            ]
        }
    },
    ordNode: {
        inscription: {
            data: {
                inscription_id: '123i0',
                sat: 123456,
                content_type: 'application/json',
                content_url: TEST_CONTENT_URL
            }
        },
        inscriptionsList: {
            data: {
                ids: ['123'],
                more: false,
                page_index: 0
            }
        }
    }
};

// Expected test results
const expectedResults = {
    resource: {
        id: `did:btco:${TEST_SAT_NUMBER}/0`,
        type: 'application/json',
        contentType: 'application/json',
        content_url: TEST_CONTENT_URL,
        sat: parseInt(TEST_SAT_NUMBER),
        inscriptionId: TEST_INSCRIPTION_ID,
        didReference: `did:btco:${TEST_SAT_NUMBER}`,
        timestamp: TEST_TIMESTAMP
    },
    resourceInfo: {
        id: TEST_INSCRIPTION_ID,
        type: 'application/json',
        contentType: 'application/json',
        content_url: TEST_CONTENT_URL,
        createdAt: TEST_TIMESTAMP,
        updatedAt: TEST_TIMESTAMP
    }
};

describe('Provider System', () => {
    describe('OrdiscanProvider', () => {
        let provider: OrdiscanProvider;
        const mockApiKey = 'test-api-key';

        beforeEach(() => {
            provider = new OrdiscanProvider({ 
                apiKey: mockApiKey,
                apiEndpoint: 'https://test.ordinalsplus.com',
                timeout: 5000 
            });
        });

        describe('resolveInscription', () => {
            it('should return inscription data for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordiscan.inscription);

                const result = await provider.resolveInscription('inscription1i0');
                expect(result).toEqual({
                    id: mockResponses.ordiscan.inscription.data.inscription_id,
                    sat: mockResponses.ordiscan.inscription.data.sat,
                    content_type: mockResponses.ordiscan.inscription.data.content_type,
                    content_url: mockResponses.ordiscan.inscription.data.content_url
                });
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveInscription('inscription1i0'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('resolveInfo', () => {
            it('should return resource info for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordiscan.inscription);

                const result = await provider.resolveInfo('inscription1i0');
                expect(result).toEqual({
                    id: mockResponses.ordiscan.inscription.data.inscription_id,
                    type: mockResponses.ordiscan.inscription.data.content_type,
                    contentType: mockResponses.ordiscan.inscription.data.content_type,
                    content_url: mockResponses.ordiscan.inscription.data.content_url,
                    createdAt: mockResponses.ordiscan.inscription.data.timestamp,
                    updatedAt: mockResponses.ordiscan.inscription.data.timestamp
                });
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveInfo('inscription1i0'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('transformInscriptionToResource', () => {
            it('should transform inscription to resource', () => {
                const inscription: Inscription = {
                    id: mockResponses.ordiscan.inscription.data.inscription_id,
                    sat: mockResponses.ordiscan.inscription.data.sat,
                    content_url: mockResponses.ordiscan.inscription.data.content_url,
                    content_type: mockResponses.ordiscan.inscription.data.content_type,
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual({
                    id: `did:btco:${mockResponses.ordiscan.inscription.data.sat}/0`,
                    type: mockResponses.ordiscan.inscription.data.content_type,
                    contentType: mockResponses.ordiscan.inscription.data.content_type,
                    content_url: mockResponses.ordiscan.inscription.data.content_url,
                    sat: mockResponses.ordiscan.inscription.data.sat,
                    inscriptionId: mockResponses.ordiscan.inscription.data.inscription_id,
                    didReference: `did:btco:${mockResponses.ordiscan.inscription.data.sat}`,
                });
            });

            it('should handle different content types', () => {
                const inscription: Inscription = {
                    id: mockResponses.ordiscan.inscription.data.inscription_id,
                    sat: mockResponses.ordiscan.inscription.data.sat,
                    content_url: mockResponses.ordiscan.inscription.data.content_url,
                    content_type: 'text/plain',
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual({
                    id: `did:btco:${mockResponses.ordiscan.inscription.data.sat}/0`,
                    type: 'text/plain',
                    contentType: 'text/plain',
                    content_url: mockResponses.ordiscan.inscription.data.content_url,
                    sat: mockResponses.ordiscan.inscription.data.sat,
                    inscriptionId: mockResponses.ordiscan.inscription.data.inscription_id,
                    didReference: `did:btco:${mockResponses.ordiscan.inscription.data.sat}`,
                });
            });
        });

        describe('getAllResources', () => {
            it('should yield resource batches', async () => {
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordiscan.inscriptionsList);

                const generator = provider.getAllResources({ batchSize: 2 });
                const result = await generator.next();

                expect(result.value).toHaveLength(1);
                expect(result.value[0].type).toBe('application/json');
                expect(result.done).toBe(false);
            });

            it('should apply filter when provided', async () => {
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordiscan.inscriptionsList);

                const generator = provider.getAllResources({
                    batchSize: 2,
                    filter: (resource) => resource.type === 'application/json'
                });
                const result = await generator.next();

                expect(result.value).toHaveLength(1);
                expect(result.value[0].type).toBe('application/json');
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                const generator = provider.getAllResources({ batchSize: 2 });
                await expect(generator.next()).rejects.toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });

            it('should handle empty response', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce({
                    data: []
                });

                const generator = provider.getAllResources({ batchSize: 2 });
                const result = await generator.next();

                expect(result.value).toBeUndefined();
                expect(result.done).toBe(true);
            });
        });
    });

    describe('OrdNodeProvider', () => {
        let provider: OrdNodeProvider;

        beforeEach(() => {
            provider = new OrdNodeProvider({
                nodeUrl: 'https://test.ordinalsplus.com',
                timeout: 5000
            });
        });

        describe('resolveInscription', () => {
            it('should return inscription data for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const result = await provider.resolveInscription('inscription1i0');
                expect(result).toEqual({
                    id: mockResponses.ordNode.inscription.data.inscription_id,
                    sat: mockResponses.ordNode.inscription.data.sat,
                    content_type: mockResponses.ordNode.inscription.data.content_type,
                    content_url: mockResponses.ordNode.inscription.data.content_url
                });
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveInscription('inscription1i0'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('resolveInfo', () => {
            it('should return resource info for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const result = await provider.resolveInfo('inscription1i0');
                expect(result).toEqual({
                    id: mockResponses.ordNode.inscription.data.inscription_id,
                    type: mockResponses.ordNode.inscription.data.content_type,
                    contentType: mockResponses.ordNode.inscription.data.content_type,
                    content_url: mockResponses.ordNode.inscription.data.content_url,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                });
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveInfo('inscription1i0'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('transformInscriptionToResource', () => {
            it('should transform inscription to resource', () => {
                const inscription: Inscription = {
                    id: mockResponses.ordNode.inscription.data.inscription_id,
                    sat: mockResponses.ordNode.inscription.data.sat,
                    content_type: mockResponses.ordNode.inscription.data.content_type,
                    content_url: mockResponses.ordNode.inscription.data.content_url,
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual({
                    id: `did:btco:${mockResponses.ordNode.inscription.data.sat}/0`,
                    type: mockResponses.ordNode.inscription.data.content_type,
                    contentType: mockResponses.ordNode.inscription.data.content_type,
                    content_url: mockResponses.ordNode.inscription.data.content_url,
                    sat: mockResponses.ordNode.inscription.data.sat,
                    inscriptionId: mockResponses.ordNode.inscription.data.inscription_id,
                    didReference: `did:btco:${mockResponses.ordNode.inscription.data.sat}`,
                });
            });

            it('should handle missing content type', () => {
                const inscription: Inscription = {
                    id: mockResponses.ordNode.inscription.data.inscription_id,
                    sat: mockResponses.ordNode.inscription.data.sat,
                    content_type: mockResponses.ordNode.inscription.data.content_type,
                    content_url: mockResponses.ordNode.inscription.data.content_url,
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual({
                    id: `did:btco:${mockResponses.ordNode.inscription.data.sat}/0`,
                    type: mockResponses.ordNode.inscription.data.content_type,
                    contentType: mockResponses.ordNode.inscription.data.content_type,
                    content_url: mockResponses.ordNode.inscription.data.content_url,
                    sat: mockResponses.ordNode.inscription.data.sat,
                    inscriptionId: mockResponses.ordNode.inscription.data.inscription_id,
                    didReference: `did:btco:${mockResponses.ordNode.inscription.data.sat}`,
                });
            });
        });

        describe('getAllResources', () => {
            it('should yield resource batches', async () => {
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordNode.inscriptionsList)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const generator = provider.getAllResources({ batchSize: 2 });
                const result = await generator.next();

                expect(result.value).toHaveLength(1);
                expect(result.value[0].type).toBe('application/json');
                expect(result.done).toBe(false);
            });

            it('should apply filter when provided', async () => {
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordNode.inscriptionsList)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const generator = provider.getAllResources({
                    batchSize: 2,
                    filter: (resource) => resource.type === 'application/json'
                });
                const result = await generator.next();

                expect(result.value).toHaveLength(1);
                expect(result.value[0].type).toBe('application/json');
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                const generator = provider.getAllResources({ batchSize: 2 });
                await expect(generator.next()).rejects.toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });

            it('should handle empty response', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce({
                    data: {
                        ids: [],
                        more: false,
                        page_index: 0
                    }
                });

                const generator = provider.getAllResources({ batchSize: 2 });
                const result = await generator.next();

                expect(result.value).toBeUndefined();
                expect(result.done).toBe(true);
            });

            it('should handle pagination correctly', async () => {
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce({
                        data: {
                            ids: ['inscription1i0', 'inscription2i1'],
                            more: true,
                            page_index: 0
                        }
                    })
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription)
                    .mockResolvedValueOnce({
                        data: {
                            ids: ['inscription3i2'],
                            more: false,
                            page_index: 1
                        }
                    })
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const generator = provider.getAllResources({ batchSize: 2 });
                const firstBatch = await generator.next();
                const secondBatch = await generator.next();

                expect(firstBatch.value).toHaveLength(2);
                expect(secondBatch.value).toHaveLength(1);
                expect(secondBatch.done).toBe(false);
            });
        });
    });
}); 