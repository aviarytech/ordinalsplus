import { describe, expect, it } from 'bun:test';
import { OrdiscanProvider } from '../src/resources/providers/ordiscan-provider';
import { OrdNodeProvider } from '../src/resources/providers/ord-node-provider';
import { ERROR_CODES } from '../src/utils/constants';
import { beforeEach, jest } from '@jest/globals';

// Test data constants
const TEST_INSCRIPTION_ID = 'abc123i0';
const TEST_SAT_NUMBER = '1234567890';
const TEST_CONTENT = { value: 'test data' };
const TEST_TIMESTAMP = '2024-01-01T00:00:00Z';

// Mock API responses
const mockResponses = {
    ordiscan: {
        satInfo: {
            data: {
                data: {
                    inscription_ids: ['inscription1i0', 'inscription2i1']
                }
            }
        },
        inscription: {
            data: {
                data: {
                    inscription_id: TEST_INSCRIPTION_ID,
                    sat: parseInt(TEST_SAT_NUMBER),
                    content_type: 'application/json',
                    content: TEST_CONTENT,
                    timestamp: TEST_TIMESTAMP,
                    number: 0
                }
            }
        },
        inscriptionsList: {
            data: {
                data: [
                    {
                        inscription_id: TEST_INSCRIPTION_ID,
                        sat: parseInt(TEST_SAT_NUMBER),
                        content_type: 'application/json',
                        content: TEST_CONTENT,
                        timestamp: TEST_TIMESTAMP,
                        number: 0
                    },
                    {
                        inscription_id: 'inscription2i1',
                        sat: parseInt(TEST_SAT_NUMBER),
                        content_type: 'text/plain',
                        content: 'plain text',
                        timestamp: TEST_TIMESTAMP,
                        number: 1
                    }
                ]
            }
        }
    },
    ordNode: {
        satInfo: {
            data: {
                inscription_ids: ['inscription1i0', 'inscription2i1']
            }
        },
        inscription: {
            data: {
                inscription_id: TEST_INSCRIPTION_ID,
                sat: parseInt(TEST_SAT_NUMBER),
                content_type: 'application/json',
                content: TEST_CONTENT,
                timestamp: TEST_TIMESTAMP,
                number: 0
            }
        },
        inscriptionsList: {
            data: {
                ids: ['inscription1i0', 'inscription2i1'],
                more: true,
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

describe('Provider System', () => {
    describe('OrdiscanProvider', () => {
        let provider: OrdiscanProvider;
        const mockApiKey = 'test-api-key';

        beforeEach(() => {
            provider = new OrdiscanProvider({ apiKey: mockApiKey });
        });

        describe('getSatInfo', () => {
            it('should return inscription IDs for a valid sat number', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordiscan.satInfo);

                const result = await provider.getSatInfo(TEST_SAT_NUMBER);
                expect(result).toEqual({ inscription_ids: ['inscription1i0', 'inscription2i1'] });
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.getSatInfo(TEST_SAT_NUMBER))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('resolveInscription', () => {
            it('should return inscription data for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordiscan.inscription);

                const result = await provider.resolveInscription('inscription1i0');
                expect(result).toEqual({
                    id: TEST_INSCRIPTION_ID,
                    sat: parseInt(TEST_SAT_NUMBER),
                    content_type: 'application/json',
                    content: TEST_CONTENT
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
                expect(result).toEqual(expectedResults.resourceInfo);
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
                const inscription = {
                    id: TEST_INSCRIPTION_ID,
                    number: 0,
                    sat: parseInt(TEST_SAT_NUMBER),
                    content_type: 'application/json',
                    content: TEST_CONTENT
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual(expectedResults.resource);
            });

            it('should handle missing content type', () => {
                const inscription = {
                    id: TEST_INSCRIPTION_ID,
                    number: 0,
                    sat: parseInt(TEST_SAT_NUMBER),
                    content: TEST_CONTENT
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual(expectedResults.resource);
            });
        });

        describe('resolveCollection', () => {
            it('should return empty array for sat with no inscriptions', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce({
                    data: { data: { inscription_ids: [] } }
                });

                const result = await provider.resolveCollection('did:btco:1234567890');
                expect(result).toEqual([]);
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveCollection('did:btco:1234567890'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('getAllResources', () => {
            it('should yield resource batches', async () => {
                // Mock the inscriptions list response
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordiscan.inscriptionsList);

                const generator = provider.getAllResources({ batchSize: 2 });
                const result = await generator.next();

                expect(result.value).toHaveLength(2);
                expect(result.value[0].type).toBe('application/json');
                expect(result.value[1].type).toBe('text/plain');
                expect(result.done).toBe(false);
            });

            it('should apply filter when provided', async () => {
                // Mock the inscriptions list response
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
                    data: {
                        data: []
                    }
                });

                const generator = provider.getAllResources({ batchSize: 2 });
                const result = await generator.next();

                expect(result.value).toBeUndefined();
                expect(result.done).toBe(true);
            });

            it('should handle pagination correctly', async () => {
                // Mock first page
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordiscan.inscriptionsList)
                    // Mock second page
                    .mockResolvedValueOnce({
                        data: {
                            data: [
                                {
                                    inscription_id: 'inscription3i2',
                                    sat: parseInt(TEST_SAT_NUMBER),
                                    content_type: 'application/json',
                                    content: TEST_CONTENT,
                                    timestamp: TEST_TIMESTAMP,
                                    number: 2
                                }
                            ]
                        }
                    });

                const generator = provider.getAllResources({ batchSize: 2 });
                const firstBatch = await generator.next();
                const secondBatch = await generator.next();

                expect(firstBatch.value).toHaveLength(2);
                expect(secondBatch.value).toHaveLength(1);
                expect(secondBatch.done).toBe(false);
            });
        });
    });

    describe('OrdNodeProvider', () => {
        let provider: OrdNodeProvider;

        beforeEach(() => {
            provider = new OrdNodeProvider({ nodeUrl: 'http://localhost:8080' });
        });

        describe('getSatInfo', () => {
            it('should return inscription IDs for a valid sat number', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordNode.satInfo);

                const result = await provider.getSatInfo(TEST_SAT_NUMBER);
                expect(result).toEqual({ inscription_ids: ['inscription1i0', 'inscription2i1'] });
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.getSatInfo(TEST_SAT_NUMBER))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('resolveInscription', () => {
            it('should return inscription data for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const result = await provider.resolveInscription('inscription1i0');
                expect(result).toEqual({
                    id: TEST_INSCRIPTION_ID,
                    sat: parseInt(TEST_SAT_NUMBER),
                    content_type: 'application/json',
                    content: TEST_CONTENT
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
                expect(result).toEqual(expectedResults.resourceInfo);
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
                const inscription = {
                    id: TEST_INSCRIPTION_ID,
                    number: 0,
                    sat: parseInt(TEST_SAT_NUMBER),
                    content_type: 'application/json',
                    content: TEST_CONTENT
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual(expectedResults.resource);
            });

            it('should handle missing content type', () => {
                const inscription = {
                    id: TEST_INSCRIPTION_ID,
                    number: 0,
                    sat: parseInt(TEST_SAT_NUMBER),
                    content: TEST_CONTENT
                };

                const result = provider.transformInscriptionToResource(inscription);
                expect(result).toEqual(expectedResults.resource);
            });
        });

        describe('resolveCollection', () => {
            it('should return empty array for sat with no inscriptions', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce({
                    data: { inscription_ids: [] }
                });

                const result = await provider.resolveCollection('did:btco:1234567890');
                expect(result).toEqual([]);
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveCollection('did:btco:1234567890'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('getAllResources', () => {
            it('should yield resource batches', async () => {
                // Mock the inscriptions list response
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordNode.inscriptionsList)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const generator = provider.getAllResources({ batchSize: 2 });
                const result = await generator.next();

                expect(result.value).toHaveLength(2);
                expect(result.value[0].type).toBe('application/json');
                expect(result.value[1].type).toBe('application/json');
                expect(result.done).toBe(false);
            });

            it('should apply filter when provided', async () => {
                // Mock the inscriptions list response
                jest.spyOn(provider as any, 'fetchApi')
                    .mockResolvedValueOnce(mockResponses.ordNode.inscriptionsList)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription)
                    .mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const generator = provider.getAllResources({
                    batchSize: 2,
                    filter: (resource) => resource.type === 'application/json'
                });
                const result = await generator.next();

                expect(result.value).toHaveLength(2);
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
                // Mock first page
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
                    // Mock second page
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