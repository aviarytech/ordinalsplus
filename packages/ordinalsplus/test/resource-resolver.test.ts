import { describe, it, expect, beforeEach } from 'bun:test';
import { jest } from '@jest/globals';
import { ResourceResolver } from '../src/resources/resource-resolver';
import { LinkedResource, ResourceInfo } from '../src/types';
import { ProviderFactory } from '../src/resources/providers/provider-factory';

describe('ResourceResolver', () => {
  let resolver: ResourceResolver;
  let mockProvider: any;

  beforeEach(() => {
    // Create a mock provider
    mockProvider = {
      getSatInfo: jest.fn(),
      resolveInscription: jest.fn()
    };

    // Mock the provider factory to return our mock provider
    jest.spyOn(ProviderFactory, 'createProvider').mockReturnValue(mockProvider);

    resolver = new ResourceResolver({
      apiKey: 'test-key',
      apiEndpoint: 'https://test.ordinalsplus.com'
    });
  });

  describe('resolveResource', () => {
    it('should resolve resource from provider', async () => {
      const mockResource: LinkedResource = {
        id: 'did:btco:123456789/0',
        type: 'application/json',
        contentType: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/1',
        inscriptionId: '123i0',
        didReference: 'did:btco:123456789',
        sat: 123456789
      };

      // Mock the provider responses
      mockProvider.getSatInfo.mockResolvedValueOnce({
        inscription_ids: ['123i0']
      });

      mockProvider.resolveInscription.mockResolvedValueOnce({
        id: '123i0',
        sat: 123456789,
        content_type: 'application/json',
        content_url: 'https://ordinalsplus.com/resource/1'
      });

      const result = await resolver.resolve(mockResource.id);
      expect(result).toEqual(mockResource);
    });

    it('should handle different content types', async () => {
      const mockResource: LinkedResource = {
        id: 'did:btco:123456789/0',
        type: 'text/plain',
        contentType: 'text/plain',
        content_url: 'https://ordinalsplus.com/resource/1',
        inscriptionId: '123i0',
        didReference: 'did:btco:123456789',
        sat: 123456789
      };

      // Mock the provider responses
      mockProvider.getSatInfo.mockResolvedValueOnce({
        inscription_ids: ['123i0']
      });

      mockProvider.resolveInscription.mockResolvedValueOnce({
        id: '123i0',
        sat: 123456789,
        content_type: 'text/plain',
        content_url: 'https://ordinalsplus.com/resource/1'
      });

      const result = await resolver.resolve(mockResource.id);
      expect(result).toEqual(mockResource);
    });

    it('should handle invalid resource ID', async () => {
      await expect(resolver.resolve('invalid-id'))
        .rejects
        .toThrow('Invalid resource identifier');
    });

    it('should handle no inscription found', async () => {
      mockProvider.getSatInfo.mockResolvedValueOnce({
        inscription_ids: []
      });

      await expect(resolver.resolve('did:btco:123456789/0'))
        .rejects
        .toThrow('No inscription found at index 0');
    });
  });
}); 