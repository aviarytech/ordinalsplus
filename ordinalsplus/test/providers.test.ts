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
                    inscription_ids: ['inscription1', 'inscription2']
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
                    timestamp: TEST_TIMESTAMP
                }
            }
        }
    },
    ordNode: {
        satInfo: {
            data: {
                inscription_ids: ['inscription1', 'inscription2']
            }
        },
        inscription: {
            data: {
                inscription_id: TEST_INSCRIPTION_ID,
                sat: parseInt(TEST_SAT_NUMBER),
                content_type: 'application/json',
                content: TEST_CONTENT,
                timestamp: TEST_TIMESTAMP
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
                expect(result).toEqual({ inscription_ids: ['inscription1', 'inscription2'] });
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

                const result = await provider.resolveInscription('inscription1');
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

                await expect(provider.resolveInscription('inscription1'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('resolveInfo', () => {
            it('should return resource info for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordiscan.inscription);

                const result = await provider.resolveInfo('inscription1');
                expect(result).toEqual(expectedResults.resourceInfo);
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveInfo('inscription1'))
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
    });

    describe('OrdNodeProvider', () => {
        let provider: OrdNodeProvider;

        beforeEach(() => {
            provider = new OrdNodeProvider();
        });

        describe('getSatInfo', () => {
            it('should return inscription IDs for a valid sat number', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordNode.satInfo);

                const result = await provider.getSatInfo(TEST_SAT_NUMBER);
                expect(result).toEqual({ inscription_ids: ['inscription1', 'inscription2'] });
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

                const result = await provider.resolveInscription('inscription1');
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

                await expect(provider.resolveInscription('inscription1'))
                    .rejects
                    .toThrow(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`);
            });
        });

        describe('resolveInfo', () => {
            it('should return resource info for a valid inscription ID', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockResolvedValueOnce(mockResponses.ordNode.inscription);

                const result = await provider.resolveInfo('inscription1');
                expect(result).toEqual(expectedResults.resourceInfo);
            });

            it('should handle network errors', async () => {
                jest.spyOn(provider as any, 'fetchApi').mockRejectedValueOnce(
                    new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status 500`)
                );

                await expect(provider.resolveInfo('inscription1'))
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
    });
}); 