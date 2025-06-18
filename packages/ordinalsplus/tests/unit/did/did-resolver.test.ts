import { DidResolver, DidResolutionResult } from '../../did/did-resolver';
import { encodeCbor } from '../../utils/cbor-utils';
import { ERROR_CODES } from '../../utils/constants';
import { ResourceProvider } from '../../resources/providers/types';

// Mock the ResourceProvider
class MockResourceProvider implements ResourceProvider {
  private readonly mockSatInfoData: Map<string, any>;
  private readonly mockInscriptionData: Map<string, any>;
  
  constructor() {
    this.mockSatInfoData = new Map();
    this.mockInscriptionData = new Map();
    
    // Set up mock data
    this.setupMockData();
  }
  
  private setupMockData() {
    // Mock a satoshi with inscriptions
    const satNumber = '123456';
    const inscriptionIds = ['abc123i0', 'def456i0'];
    this.mockSatInfoData.set(satNumber, {
      number: satNumber,
      inscription_ids: inscriptionIds
    });
    
    // Create a valid DID Document as metadata
    const validDidDocument = {
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
      id: `did:btco:${satNumber}`,
      verificationMethod: [{
        id: `did:btco:${satNumber}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: `did:btco:${satNumber}`,
        publicKeyMultibase: 'z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH'
      }],
      authentication: [`did:btco:${satNumber}#key-1`]
    };
    
    // Create another version of the DID Document
    const updatedDidDocument = {
      ...validDidDocument,
      service: [{
        id: `did:btco:${satNumber}#service-1`,
        type: 'LinkedDomains',
        serviceEndpoint: 'https://example.com'
      }]
    };
    
    // Mock the first inscription with valid DID Document
    this.mockInscriptionData.set(inscriptionIds[0], {
      id: inscriptionIds[0],
      number: 0,
      sat: parseInt(satNumber),
      content_type: 'application/cbor',
      content_url: `https://ordinalindex.org/content/${inscriptionIds[0]}`,
      timestamp: 1715000000000,
      metadata: encodeCbor(validDidDocument)
    });
    
    // Mock the second inscription with updated DID Document
    this.mockInscriptionData.set(inscriptionIds[1], {
      id: inscriptionIds[1],
      number: 1,
      sat: parseInt(satNumber),
      content_type: 'application/cbor',
      content_url: `https://ordinalindex.org/content/${inscriptionIds[1]}`,
      timestamp: 1715100000000,
      metadata: encodeCbor(updatedDidDocument)
    });
    
    // Mock a satoshi with no inscriptions
    this.mockSatInfoData.set('654321', {
      number: '654321',
      inscription_ids: []
    });
    
    // Mock a satoshi with invalid DID Document
    const invalidSatNumber = '789012';
    const invalidInscriptionId = 'ghi789i0';
    this.mockSatInfoData.set(invalidSatNumber, {
      number: invalidSatNumber,
      inscription_ids: [invalidInscriptionId]
    });
    
    // Invalid metadata that's not a DID Document
    const invalidData = {
      title: 'Not a DID Document',
      description: 'This is not a valid DID Document'
    };
    
    this.mockInscriptionData.set(invalidInscriptionId, {
      id: invalidInscriptionId,
      number: 0,
      sat: parseInt(invalidSatNumber),
      content_type: 'application/cbor',
      content_url: `https://ordinalindex.org/content/${invalidInscriptionId}`,
      timestamp: 1715200000000,
      metadata: encodeCbor(invalidData)
    });
  }
  
  async getSatInfo(satNumber: string): Promise<any> {
    const data = this.mockSatInfoData.get(satNumber);
    if (!data) {
      throw new Error(`No satoshi info found for ${satNumber}`);
    }
    return data;
  }
  
  async resolveInscription(inscriptionId: string): Promise<any> {
    const data = this.mockInscriptionData.get(inscriptionId);
    if (!data) {
      throw new Error(`No inscription found with ID ${inscriptionId}`);
    }
    return data;
  }
  
  async resolveResource(resourceId: string): Promise<any> {
    throw new Error('Method not implemented');
  }
  
  async resolveCollection(didUrl: string, options?: any): Promise<any[]> {
    throw new Error('Method not implemented');
  }
}

// Create a test factory that uses our mock provider
jest.mock('../../resources/providers/provider-factory', () => ({
  ProviderType: {
    ORDISCAN: 'ORDISCAN',
    ORD_NODE: 'ORD_NODE'
  },
  ProviderFactory: {
    createProvider: jest.fn().mockImplementation(() => {
      return new MockResourceProvider();
    })
  }
}));

describe('DidResolver', () => {
  let resolver: DidResolver;
  
  beforeEach(() => {
    resolver = new DidResolver();
  });
  
  describe('resolve', () => {
    it('should resolve a DID to a DID Document', async () => {
      const result = await resolver.resolve('did:btco:123456');
      
      expect(result.didDocument).not.toBeNull();
      expect(result.didDocument?.id).toBe('did:btco:123456');
      expect(result.didResolutionMetadata.error).toBeUndefined();
      expect(result.didResolutionMetadata.contentType).toBe('application/did+json');
      expect(result.didDocumentMetadata.created).toBeDefined();
    });
    
    it('should resolve a specific version of a DID Document', async () => {
      const result = await resolver.resolve('did:btco:123456/1');
      
      expect(result.didDocument).not.toBeNull();
      expect(result.didDocument?.id).toBe('did:btco:123456');
      expect(result.didDocument?.service).toBeDefined();
      expect(result.didDocument?.service?.length).toBe(1);
      expect(result.didResolutionMetadata.versionId).toBe('1');
    });
    
    it('should return an error for non-existent DIDs', async () => {
      const result = await resolver.resolve('did:btco:999999');
      
      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBeDefined();
    });
    
    it('should return an error for DIDs with no inscriptions', async () => {
      const result = await resolver.resolve('did:btco:654321');
      
      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBe(ERROR_CODES.NOT_FOUND);
    });
    
    it('should handle invalid metadata', async () => {
      const result = await resolver.resolve('did:btco:789012');
      
      expect(result.didDocument).toBeNull();
      // The issue could be that the metadata isn't a DID Document or couldn't be decoded
      expect(result.didResolutionMetadata.error).toBeDefined();
    });
    
    it('should return an error for unsupported DID methods', async () => {
      const result = await resolver.resolve('did:web:example.com');
      
      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBe(ERROR_CODES.METHOD_NOT_SUPPORTED);
    });
    
    it('should return an error for invalid DID URL format', async () => {
      const result = await resolver.resolve('invalid-did-url');
      
      expect(result.didDocument).toBeNull();
      expect(result.didResolutionMetadata.error).toBe(ERROR_CODES.INVALID_DID);
    });
    
    it('should use cache when enabled', async () => {
      const spy = jest.spyOn(MockResourceProvider.prototype, 'getSatInfo');
      
      // First call should hit the provider
      await resolver.resolve('did:btco:123456');
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Second call should use cache
      await resolver.resolve('did:btco:123456');
      expect(spy).toHaveBeenCalledTimes(1);
      
      // Call with noCache option should bypass cache
      await resolver.resolve('did:btco:123456', { noCache: true });
      expect(spy).toHaveBeenCalledTimes(2);
      
      spy.mockRestore();
    });
    
    it('should resolve a new DID', async () => {
      const result = await resolver.resolve('did:btco:1908770696977240');
      
      expect(result.didDocument).toBeDefined();
      expect(result.didDocument?.id).toBe('did:btco:1908770696977240');
    });
  });
  
  describe('parseDidUrl', () => {
    it('should parse a basic DID', () => {
      const parsed = (resolver as any).parseDidUrl('did:btco:123456');
      
      expect(parsed).toBeDefined();
      expect(parsed.method).toBe('btco');
      expect(parsed.id).toBe('123456');
      expect(parsed.did).toBe('did:btco:123456');
      expect(parsed.path).toBeUndefined();
      expect(parsed.query).toBeUndefined();
      expect(parsed.fragment).toBeUndefined();
      expect(parsed.versionIndex).toBeUndefined();
    });
    
    it('should parse a DID with version index', () => {
      const parsed = (resolver as any).parseDidUrl('did:btco:123456/1');
      
      expect(parsed).toBeDefined();
      expect(parsed.method).toBe('btco');
      expect(parsed.id).toBe('123456');
      expect(parsed.path).toBe('/1');
      expect(parsed.versionIndex).toBe(1);
    });
    
    it('should parse a DID with fragment', () => {
      const parsed = (resolver as any).parseDidUrl('did:btco:123456#key-1');
      
      expect(parsed).toBeDefined();
      expect(parsed.method).toBe('btco');
      expect(parsed.id).toBe('123456');
      expect(parsed.fragment).toBe('#key-1');
    });
    
    it('should parse a DID with query', () => {
      const parsed = (resolver as any).parseDidUrl('did:btco:123456?service=LinkedDomains');
      
      expect(parsed).toBeDefined();
      expect(parsed.method).toBe('btco');
      expect(parsed.id).toBe('123456');
      expect(parsed.query).toBe('?service=LinkedDomains');
    });
    
    it('should parse a complex DID URL', () => {
      const parsed = (resolver as any).parseDidUrl('did:btco:123456/1?service=LinkedDomains#key-1');
      
      expect(parsed).toBeDefined();
      expect(parsed.method).toBe('btco');
      expect(parsed.id).toBe('123456');
      expect(parsed.path).toBe('/1');
      expect(parsed.query).toBe('?service=LinkedDomains');
      expect(parsed.fragment).toBe('#key-1');
      expect(parsed.versionIndex).toBe(1);
    });
    
    it('should return null for invalid DIDs', () => {
      expect((resolver as any).parseDidUrl('notadid')).toBeNull();
      expect((resolver as any).parseDidUrl('did:method')).toBeNull();
      expect((resolver as any).parseDidUrl('did:method:')).toBeNull();
    });
  });
}); 