import { ResourceInscriptionService, ResourceInscriptionStatus, ResourceInscriptionRequest } from '../resourceInscriptionService';
import { ApiService } from '../apiService';
import { DIDService } from '../didService';

// Mock the inscription orchestrator
jest.mock('../../../../ordinalsplus/src/inscription/InscriptionOrchestrator', () => ({
  inscriptionOrchestrator: {
    reset: jest.fn(),
    prepareContent: jest.fn().mockResolvedValue(undefined),
    selectUTXO: jest.fn(),
    calculateFees: jest.fn().mockResolvedValue({ commit: 1000, reveal: 2000, total: 3000 }),
    executeCommitTransaction: jest.fn().mockResolvedValue('mock-commit-txid'),
    executeRevealTransaction: jest.fn().mockResolvedValue('mock-reveal-txid'),
    getState: jest.fn().mockReturnValue({})
  }
}));

// Mock repositories and services
const mockInscriptionRepository = {
  createInscription: jest.fn(),
  getInscriptionById: jest.fn(),
  getInscriptionsByParentDid: jest.fn(),
  updateInscription: jest.fn()
};

const mockApiService = {} as ApiService;
const mockDIDService = new DIDService();

describe('ResourceInscriptionService', () => {
  let service: ResourceInscriptionService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize the service with mocks
    service = new ResourceInscriptionService(
      mockInscriptionRepository,
      mockApiService,
      mockDIDService,
      { enableDebugLogging: true }
    );
    
    // Set up repository mocks
    mockInscriptionRepository.createInscription.mockImplementation(async (inscription) => ({
      id: 'test-inscription-id',
      ...inscription
    }));
    
    mockInscriptionRepository.getInscriptionById.mockResolvedValue({
      id: 'test-inscription-id',
      parentDid: 'did:btco:1908770696977240/0',
      requesterDid: 'did:btco:1908770696991731/0',
      label: 'Test Resource',
      resourceType: 'image',
      contentType: 'image/png',
      contentSize: 1024,
      status: ResourceInscriptionStatus.PENDING,
      requestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      satoshi: '123456',
      fees: {
        feeRate: 10,
        total: 0,
        commit: 0,
        reveal: 0
      },
      transactions: {}
    });
    
    mockInscriptionRepository.updateInscription.mockImplementation(async (id, update) => ({
      id,
      parentDid: 'did:btco:1908770696977240/0',
      requesterDid: 'did:btco:1908770696991731/0',
      label: 'Test Resource',
      resourceType: 'image',
      contentType: 'image/png',
      contentSize: 1024,
      status: update.status || ResourceInscriptionStatus.PENDING,
      requestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      satoshi: '123456',
      ...update
    }));
  });
  
  describe('startInscription', () => {
    it('should create a new resource inscription request', async () => {
      // Arrange
      const request: ResourceInscriptionRequest = {
        parentDid: 'did:btco:1908770696977240/0',
        requesterDid: 'did:btco:1908770696991731/0',
        content: Buffer.from('test content'),
        contentType: 'image/png',
        label: 'Test Resource',
        resourceType: 'image'
      };
      
      // Act
      const result = await service.startInscription(request);
      
      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe('test-inscription-id');
      expect(result.parentDid).toBe(request.parentDid);
      expect(result.status).toBe(ResourceInscriptionStatus.PENDING);
      expect(mockInscriptionRepository.createInscription).toHaveBeenCalledTimes(1);
    });
    
    it('should reject invalid DID formats', async () => {
      // Arrange
      const request: ResourceInscriptionRequest = {
        parentDid: 'invalid-did',
        requesterDid: 'did:btco:1908770696991731/0',
        content: Buffer.from('test content'),
        contentType: 'image/png',
        label: 'Test Resource',
        resourceType: 'image'
      };
      
      // Act & Assert
      await expect(service.startInscription(request)).rejects.toThrow('Invalid DID format');
    });
    
    it('should reject oversized resources', async () => {
      // Arrange
      const service = new ResourceInscriptionService(
        mockInscriptionRepository,
        mockApiService,
        mockDIDService,
        { 
          enableDebugLogging: true,
          maxResourceSize: 10 // Very small limit for testing
        }
      );
      
      const request: ResourceInscriptionRequest = {
        parentDid: 'did:btco:1908770696977240/0',
        requesterDid: 'did:btco:1908770696991731/0',
        content: Buffer.from('test content that is too large'),
        contentType: 'image/png',
        label: 'Test Resource',
        resourceType: 'image'
      };
      
      // Act & Assert
      await expect(service.startInscription(request)).rejects.toThrow('Resource size');
    });
  });
  
  describe('processResourceInscription', () => {
    it('should process a resource inscription successfully', async () => {
      // This test relies on the private method being called by startInscription
      // We'll verify the repository calls to ensure it was processed correctly
      
      // Arrange
      const request: ResourceInscriptionRequest = {
        parentDid: 'did:btco:1908770696977240/0',
        requesterDid: 'did:btco:1908770696991731/0',
        content: Buffer.from('test content'),
        contentType: 'image/png',
        label: 'Test Resource',
        resourceType: 'image'
      };
      
      // Act
      await service.startInscription(request);
      
      // Wait for the async process to complete
      // In a real test, we'd use something like waitFor or a proper mock implementation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      // First update should set status to IN_PROGRESS
      expect(mockInscriptionRepository.updateInscription).toHaveBeenCalledWith(
        'test-inscription-id',
        expect.objectContaining({
          status: ResourceInscriptionStatus.IN_PROGRESS
        })
      );
      
      // Second update should set status to COMPLETED
      expect(mockInscriptionRepository.updateInscription).toHaveBeenCalledWith(
        'test-inscription-id',
        expect.objectContaining({
          status: ResourceInscriptionStatus.COMPLETED,
          inscriptionId: 'mock-reveal-txid'
        })
      );
    });
    
    it('should handle errors during inscription', async () => {
      // Arrange
      const orchestrator = require('../../../../ordinalsplus/src/inscription/InscriptionOrchestrator').inscriptionOrchestrator;
      orchestrator.executeRevealTransaction.mockRejectedValueOnce(new Error('Reveal transaction failed'));
      
      const request: ResourceInscriptionRequest = {
        parentDid: 'did:btco:1908770696977240/0',
        requesterDid: 'did:btco:1908770696991731/0',
        content: Buffer.from('test content'),
        contentType: 'image/png',
        label: 'Test Resource',
        resourceType: 'image'
      };
      
      // Act
      await service.startInscription(request);
      
      // Wait for the async process to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Assert
      // Should update with FAILED status and error message
      expect(mockInscriptionRepository.updateInscription).toHaveBeenCalledWith(
        'test-inscription-id',
        expect.objectContaining({
          status: ResourceInscriptionStatus.FAILED,
          error: 'Reveal transaction failed'
        })
      );
    });
  });
});
