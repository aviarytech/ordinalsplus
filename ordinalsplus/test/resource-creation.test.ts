import { describe, it, expect, beforeEach, spyOn } from 'bun:test';
import { prepareResourceInscription, validateResourceCreationParams } from '../src/transactions/resource-creation';
import * as inscriptionModule from '../src/inscription/scripts/ordinal-reveal';

// Mock prepared inscription
const mockPreparedInscription = {
  commitAddress: {
    address: 'tb1p9h0yjdupyfpxfjg24rpx755xrplvzd9hz2nj9k',
    script: new Uint8Array([0, 20, 216, 92, 43, 113, 208, 6, 11, 9, 201, 136, 106, 235, 129, 94, 80, 153, 29, 218, 18, 77]),
    internalKey: new Uint8Array(32)
  },
  inscription: {
    tags: {
      contentType: 'text/plain',
      unknown: undefined
    },
    body: new Uint8Array([84, 101, 115, 116, 32, 99, 111, 110, 116, 101, 110, 116]) // "Test content"
  },
  revealPublicKey: new Uint8Array(32),
  inscriptionScript: {
    script: new Uint8Array(10),
    controlBlock: new Uint8Array(33),
    leafVersion: 0xc0
  }
};

describe('Resource Creation Functions', () => {
  // Valid test parameters
  const validParams = {
    content: 'Test content',
    contentType: 'text/plain',
    resourceType: 'notes',
    publicKey: new Uint8Array(32),
    recipientAddress: 'tb1q9h0yjdupyfpxfjg24rpx755xrplvzd9hz2nj9k',
    feeRate: 10,
    network: 'signet',
    metadata: { test: 'value' }
  };
  
  beforeEach(() => {
    // Setup spies for the functions we use
    spyOn(inscriptionModule, 'prepareInscription').mockImplementation(() => mockPreparedInscription);
  });

  describe('validateResourceCreationParams', () => {
    it('should validate correct parameters without throwing', () => {
      expect(() => validateResourceCreationParams(validParams as any)).not.toThrow();
    });
    
    it('should throw an error if content is missing', () => {
      const params = { ...validParams, content: undefined };
      expect(() => validateResourceCreationParams(params as any)).toThrow('Resource content is required');
    });
    
    it('should throw an error if resource type is missing', () => {
      const params = { ...validParams, resourceType: undefined };
      expect(() => validateResourceCreationParams(params as any)).toThrow('Resource type is required');
    });
    
    it('should throw an error if public key is invalid', () => {
      const params = { ...validParams, publicKey: undefined };
      expect(() => validateResourceCreationParams(params as any)).toThrow('Valid public key is required');
    });
    
    it('should throw an error if the network is unsupported', () => {
      const params = { ...validParams, network: 'unsupported' };
      expect(() => validateResourceCreationParams(params as any)).toThrow('Valid network is required');
    });
  });

  describe('prepareResourceInscription', () => {
    it('should prepare resource inscription successfully', async () => {
      const result = await prepareResourceInscription(validParams as any);
      
      // Check if prepareInscription function was called
      expect(inscriptionModule.prepareInscription).toHaveBeenCalled();
      
      // Check result structure
      expect(result).toHaveProperty('preparedInscription');
      expect(result).toHaveProperty('estimatedRevealFee');
      expect(result).toHaveProperty('requiredCommitAmount');
      
      // Verify that the preparedInscription is what we expected
      expect(result.preparedInscription).toEqual(mockPreparedInscription);
      
      // Ensure fee calculations are working
      expect(result.estimatedRevealFee).toBeGreaterThan(0);
      expect(result.requiredCommitAmount).toBeGreaterThan(result.estimatedRevealFee);
    });
    
    it('should handle errors during preparation', async () => {
      // Override the mock to throw an error
      spyOn(inscriptionModule, 'prepareInscription').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Expect the function to throw with enhanced error message
      await expect(prepareResourceInscription(validParams as any)).rejects.toThrow('Failed to prepare resource inscription: Test error');
    });
    
    it('should auto-detect content type for JSON strings', async () => {
      const jsonParams = {
        ...validParams,
        content: '{"test": "json content"}',
        contentType: undefined
      };
      
      await prepareResourceInscription(jsonParams as any);
      
      // Verify that prepareInscription was called with the correct content type
      expect(inscriptionModule.prepareInscription).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            contentType: 'application/json'
          })
        })
      );
    });
  });
}); 