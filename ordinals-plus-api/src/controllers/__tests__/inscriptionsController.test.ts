/**
 * Unit tests for inscriptionsController
 * 
 * Tests the inscription-related controller functions:
 * - getFeeEstimates
 * - createInscriptionPsbts
 * - getTransactionStatus
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';

// First, import the original modules
import * as feeService from '../../services/feeService';
import * as blockchainService from '../../services/blockchainService';
import * as psbtCreation from '../../../../ordinalsplus/src/transactions/psbt-creation';

// Then import the controller that uses these modules
import { 
  getFeeEstimates, 
  createInscriptionPsbts, 
  getTransactionStatus 
} from '../inscriptionsController';

import type { 
  CreatePsbtsRequest, 
  CombinedPsbtResponse,
  FeeEstimateResponse, 
  TransactionStatusResponse
} from '../../types';

describe('inscriptionsController', () => {
  // Save original console methods for restoration
  const originalConsoleLog = console.log;
  const originalConsoleError = console.error;
  let consoleOutput: string[] = [];

  // Mock responses
  const mockFeeEstimates: FeeEstimateResponse = {
    low: 1,
    medium: 5,
    high: 10
  };

  const mockCombinedPsbtResponse: CombinedPsbtResponse = {
    commitPsbtBase64: 'mock-commit-psbt',
    unsignedRevealPsbtBase64: 'mock-reveal-psbt',
    revealSignerWif: 'mock-wif'
  };

  const mockTransactionStatus: TransactionStatusResponse = {
    status: 'confirmed',
    blockHeight: 800000,
    inscriptionId: 'mock-inscription-id'
  };

  // Create spies
  let feeServiceSpy: any;
  let blockchainServiceSpy: any;
  let psbtCreationSpy: any;

  beforeEach(() => {
    // Set up spies
    feeServiceSpy = spyOn(feeService, 'getFeeEstimates');
    blockchainServiceSpy = spyOn(blockchainService, 'getTransactionStatus');
    psbtCreationSpy = spyOn(psbtCreation, 'createInscriptionPsbts');
    
    // Mock console methods to capture output
    consoleOutput = [];
    console.log = (...args: any[]) => {
      consoleOutput.push(args.join(' '));
    };
    console.error = (...args: any[]) => {
      consoleOutput.push(`ERROR: ${args.join(' ')}`);
    };

    // Set up default mock implementations
    feeServiceSpy.mockImplementation(async () => mockFeeEstimates);
    blockchainServiceSpy.mockImplementation(async () => mockTransactionStatus);
    psbtCreationSpy.mockImplementation(async () => mockCombinedPsbtResponse);
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });

  describe('getFeeEstimates', () => {
    it('should fetch fee estimates for the default network', async () => {
      // Act
      const result = await getFeeEstimates();
      
      // Assert
      expect(result).toEqual(mockFeeEstimates);
      expect(feeServiceSpy).toHaveBeenCalledWith('mainnet');
      expect(consoleOutput.some(log => log.includes('[inscriptionsController] Fetching fee estimates for network:'))).toBe(true);
    });

    it('should fetch fee estimates for a specified network', async () => {
      // Act
      const result = await getFeeEstimates('signet');
      
      // Assert
      expect(result).toEqual(mockFeeEstimates);
      expect(feeServiceSpy).toHaveBeenCalledWith('signet');
      expect(consoleOutput.some(log => log.includes('[inscriptionsController] Fetching fee estimates for network: signet'))).toBe(true);
    });

    it('should handle errors from fee service', async () => {
      // Arrange
      feeServiceSpy.mockImplementation(async () => {
        throw new Error('Fee service error');
      });
      
      // Act & Assert
      await expect(getFeeEstimates()).rejects.toThrow('Fee service error');
      expect(consoleOutput.some(log => log.includes('[inscriptionsController] Error fetching fee estimates:'))).toBe(true);
    });
  });

  describe('createInscriptionPsbts', () => {
    it('should create PSBTs for an inscription', async () => {
      // Arrange
      const request: CreatePsbtsRequest = {
        contentType: 'text/plain',
        contentBase64: 'SGVsbG8sIFdvcmxkIQ==', // "Hello, World!" in base64
        feeRate: 5,
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        utxos: [
          {
            txid: '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511',
            vout: 0,
            value: 20000,
            scriptPubKey: '00144b3bde9b6b10774a5a822c1f99731db7949c2f5b'
          }
        ],
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        networkType: 'testnet'
      };
      
      // Act
      const result = await createInscriptionPsbts(request);
      
      // Assert
      expect(result).toEqual(mockCombinedPsbtResponse);
      expect(psbtCreationSpy).toHaveBeenCalledWith({
        contentType: request.contentType,
        content: request.contentBase64,
        feeRate: request.feeRate,
        recipientAddress: request.recipientAddress,
        utxos: request.utxos,
        changeAddress: request.changeAddress,
        network: request.networkType,
        testMode: false
      });
      expect(consoleOutput.some(log => log.includes('[inscriptionsController] Creating Inscription PSBTs'))).toBe(true);
      expect(consoleOutput.some(log => log.includes('[inscriptionsController] Successfully created inscription PSBTs'))).toBe(true);
    });

    it('should handle errors from PSBT creation', async () => {
      // Arrange
      psbtCreationSpy.mockImplementation(async () => {
        throw new Error('PSBT creation error');
      });

      const request: CreatePsbtsRequest = {
        contentType: 'text/plain',
        contentBase64: 'SGVsbG8sIFdvcmxkIQ==',
        feeRate: 5,
        recipientAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        utxos: [],
        changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
        networkType: 'testnet'
      };
      
      // Act & Assert
      await expect(createInscriptionPsbts(request)).rejects.toThrow('Failed to create inscription PSBTs: PSBT creation error');
      expect(consoleOutput.some(log => log.includes('[inscriptionsController] Error creating inscription PSBTs:'))).toBe(true);
    });
  });

  describe('getTransactionStatus', () => {
    it('should fetch transaction status for a txid', async () => {
      // Arrange
      const txid = '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511';
      
      // Act
      const result = await getTransactionStatus(txid);
      
      // Assert
      expect(result).toEqual(mockTransactionStatus);
      expect(blockchainServiceSpy).toHaveBeenCalledWith(txid);
      expect(consoleOutput.some(log => log.includes(`[inscriptionsController] Checking status for transaction: ${txid}`))).toBe(true);
    });

    it('should handle errors from blockchain service', async () => {
      // Arrange
      blockchainServiceSpy.mockImplementation(async () => {
        throw new Error('Blockchain service error');
      });
      
      const txid = '5e3ab20b5cdd8b988e2bdbf27d1fb63255e49a2fd6c0e0e7ac8d212deedf6511';
      
      // Act & Assert
      await expect(getTransactionStatus(txid)).rejects.toThrow('Failed to check transaction status');
      expect(consoleOutput.some(log => log.includes(`[inscriptionsController] Error checking transaction status for ${txid}:`))).toBe(true);
    });
  });
}); 