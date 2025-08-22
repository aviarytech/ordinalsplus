import { describe, test, expect, beforeEach } from 'bun:test';
import { 
  prepareBatchCommitTransaction, 
  BatchCommitTransactionParams,
  BatchInscriptionParams,
  BatchCommitTransactionResult
} from '../../../src/transactions/batch-commit-transaction';
import { Utxo, BitcoinNetwork } from '../../../src/types';

/**
 * Test suite for batch commit transaction process.
 * Tests the ability to create multiple inscription commits in a single transaction.
 */
describe('Batch Commit Transaction Process', () => {
  // Mock Bitcoin network for testing
  const mockNetwork: BitcoinNetwork = 'testnet';
  
  // Sample UTXOs for tests - need sufficient funds for multiple inscriptions
  const mockUtxos: Utxo[] = [
    {
      txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      vout: 0,
      value: 50000, // 50k sats
      scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
    },
    {
      txid: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      vout: 1,
      value: 100000, // 100k sats
      scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
    }
  ];
  
  // Sample change address
  const mockChangeAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
  
  // Sample batch inscriptions
  const mockBatchInscriptions: BatchInscriptionParams[] = [
    {
      content: 'Hello, World! #1',
      contentType: 'text/plain',
      postage: 1000,
      metadata: { name: 'Test 1', number: '1' }
    },
    {
      content: JSON.stringify({ message: 'Hello from JSON', id: 2 }),
      contentType: 'application/json',
      postage: 2000,
      metadata: { name: 'Test 2', number: '2' }
    },
    {
      content: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), // "Hello" in bytes
      contentType: 'application/octet-stream',
      postage: 1500,
      metadata: { name: 'Test 3', number: '3' }
    }
  ];
  
  test('should create a valid batch commit transaction with multiple inscriptions', async () => {
    const params: BatchCommitTransactionParams = {
      inscriptions: mockBatchInscriptions,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    const result = await prepareBatchCommitTransaction(params);
    
    // Verify basic structure
    expect(result).toBeDefined();
    expect(result.inscriptions).toHaveLength(3);
    expect(result.commitPsbtBase64).toBeDefined();
    expect(result.commitPsbt).toBeDefined();
    expect(result.selectedUtxos).toBeDefined();
    expect(result.fees.commit).toBeGreaterThan(0);
    
    // Verify total commit amount
    const expectedTotal = mockBatchInscriptions.reduce((sum, ins) => sum + ins.postage, 0);
    expect(result.totalCommitAmount).toBe(expectedTotal);
    
    // Verify each inscription result
    for (let i = 0; i < result.inscriptions.length; i++) {
      const inscriptionResult = result.inscriptions[i];
      const originalParams = mockBatchInscriptions[i];
      
      expect(inscriptionResult.index).toBe(i);
      expect(inscriptionResult.commitAddress).toBeDefined();
      expect(inscriptionResult.commitAddress).toMatch(/^tb1p/); // P2TR address for testnet
      expect(inscriptionResult.postage).toBe(originalParams.postage);
      expect(inscriptionResult.inscription).toBeDefined();
      expect(inscriptionResult.expectedSatRange).toBeDefined();
      expect(inscriptionResult.expectedSatRange.start).toBeGreaterThanOrEqual(0);
      expect(inscriptionResult.expectedSatRange.end).toBeGreaterThan(inscriptionResult.expectedSatRange.start);
    }
    
    // Verify sat ranges are sequential and don't overlap
    for (let i = 1; i < result.inscriptions.length; i++) {
      const current = result.inscriptions[i];
      const previous = result.inscriptions[i - 1];
      expect(current.expectedSatRange.start).toBe(previous.expectedSatRange.end + 1);
    }
    
    // Verify PSBT is valid base64
    expect(() => Buffer.from(result.commitPsbtBase64, 'base64')).not.toThrow();
  });
  
  test('should handle single inscription in batch', async () => {
    const singleInscription: BatchInscriptionParams[] = [
      {
        content: 'Single inscription test',
        contentType: 'text/plain',
        postage: 1000
      }
    ];
    
    const params: BatchCommitTransactionParams = {
      inscriptions: singleInscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    const result = await prepareBatchCommitTransaction(params);
    
    expect(result.inscriptions).toHaveLength(1);
    expect(result.totalCommitAmount).toBe(1000);
    expect(result.inscriptions[0].expectedSatRange.start).toBe(0);
    expect(result.inscriptions[0].expectedSatRange.end).toBe(999);
  });
  
  test('should validate postage amounts against dust limit', async () => {
    const invalidInscriptions: BatchInscriptionParams[] = [
      {
        content: 'Valid inscription',
        contentType: 'text/plain',
        postage: 1000 // Valid
      },
      {
        content: 'Invalid inscription',
        contentType: 'text/plain',
        postage: 500 // Below dust limit (546)
      }
    ];
    
    const params: BatchCommitTransactionParams = {
      inscriptions: invalidInscriptions,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    await expect(prepareBatchCommitTransaction(params)).rejects.toThrow(
      'Inscription 1 postage (500) is below dust limit (546)'
    );
  });
  
  test('should throw error when no inscriptions provided', async () => {
    const params: BatchCommitTransactionParams = {
      inscriptions: [],
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    await expect(prepareBatchCommitTransaction(params)).rejects.toThrow(
      'No inscriptions provided for batch commit transaction.'
    );
  });
  
  test('should throw error when no UTXOs provided', async () => {
    const params: BatchCommitTransactionParams = {
      inscriptions: mockBatchInscriptions,
      utxos: [],
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    await expect(prepareBatchCommitTransaction(params)).rejects.toThrow(
      'No UTXOs provided to fund the transaction.'
    );
  });
  
  test('should throw error when change address is missing', async () => {
    const params: BatchCommitTransactionParams = {
      inscriptions: mockBatchInscriptions,
      utxos: mockUtxos,
      changeAddress: '',
      feeRate: 2,
      network: mockNetwork
    };
    
    await expect(prepareBatchCommitTransaction(params)).rejects.toThrow(
      'Change address is required.'
    );
  });
  
  test('should throw error with invalid fee rate', async () => {
    const params: BatchCommitTransactionParams = {
      inscriptions: mockBatchInscriptions,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 0,
      network: mockNetwork
    };
    
    await expect(prepareBatchCommitTransaction(params)).rejects.toThrow(
      'Invalid fee rate: 0'
    );
  });
  
  test('should throw error with insufficient funds', async () => {
    // Use small UTXOs that can't cover the batch
    const smallUtxos: Utxo[] = [
      {
        txid: 'small1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab',
        vout: 0,
        value: 1000, // Only 1k sats - not enough for batch
        scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
      }
    ];
    
    const params: BatchCommitTransactionParams = {
      inscriptions: mockBatchInscriptions,
      utxos: smallUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    await expect(prepareBatchCommitTransaction(params)).rejects.toThrow(/Insufficient funds/);
  });
  
  test('should handle different content types correctly', async () => {
    const diverseInscriptions: BatchInscriptionParams[] = [
      {
        content: 'Plain text content',
        contentType: 'text/plain',
        postage: 1000
      },
      {
        content: JSON.stringify({ key: 'value', array: [1, 2, 3] }),
        contentType: 'application/json',
        postage: 1200
      },
      {
        content: '<html><body>HTML content</body></html>',
        contentType: 'text/html',
        postage: 1100
      },
      {
        content: new Uint8Array([0x89, 0x50, 0x4E, 0x47]), // PNG header bytes
        contentType: 'image/png',
        postage: 1500
      }
    ];
    
    const params: BatchCommitTransactionParams = {
      inscriptions: diverseInscriptions,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    const result = await prepareBatchCommitTransaction(params);
    
    expect(result.inscriptions).toHaveLength(4);
    
    // Verify each inscription has the correct content type in its prepared inscription
    for (let i = 0; i < result.inscriptions.length; i++) {
      const inscriptionResult = result.inscriptions[i];
      const originalParams = diverseInscriptions[i];
      
      expect(inscriptionResult.inscription.inscription.tags.contentType).toBe(originalParams.contentType);
    }
  });
  
  test('should handle metadata correctly', async () => {
    const inscriptionsWithMetadata: BatchInscriptionParams[] = [
      {
        content: 'Content with metadata',
        contentType: 'text/plain',
        postage: 1000,
        metadata: { 
          title: 'Test Title',
          description: 'Test Description',
          creator: 'Test Creator'
        }
      },
      {
        content: 'Content without metadata',
        contentType: 'text/plain',
        postage: 1000
        // No metadata
      }
    ];
    
    const params: BatchCommitTransactionParams = {
      inscriptions: inscriptionsWithMetadata,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    const result = await prepareBatchCommitTransaction(params);
    
    // First inscription should have metadata
    const firstInscription = result.inscriptions[0].inscription.inscription;
    expect(firstInscription.tags.metadata).toBeDefined();
    expect(firstInscription.tags.metadata).toEqual(inscriptionsWithMetadata[0].metadata);
    
    // Second inscription should not have metadata
    const secondInscription = result.inscriptions[1].inscription.inscription;
    expect(secondInscription.tags.metadata).toBeUndefined();
  });
  
  test('should calculate fees correctly for different batch sizes', async () => {
    // Test with different batch sizes
    const batchSizes = [1, 3, 5, 10];
    
    for (const size of batchSizes) {
      const inscriptions: BatchInscriptionParams[] = [];
      for (let i = 0; i < size; i++) {
        inscriptions.push({
          content: `Content ${i}`,
          contentType: 'text/plain',
          postage: 1000
        });
      }
      
      // Use larger UTXOs for bigger batches
      const largeUtxos: Utxo[] = [
        {
          txid: `large${i}234567890abcdef1234567890abcdef1234567890abcdef1234567890ab`,
          vout: 0,
          value: 500000, // 500k sats
          scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
        }
      ];
      
      const params: BatchCommitTransactionParams = {
        inscriptions,
        utxos: largeUtxos,
        changeAddress: mockChangeAddress,
        feeRate: 2,
        network: mockNetwork
      };
      
      const result = await prepareBatchCommitTransaction(params);
      
      expect(result.inscriptions).toHaveLength(size);
      expect(result.totalCommitAmount).toBe(size * 1000);
      expect(result.fees.commit).toBeGreaterThan(0);
      
      // Larger batches should generally have higher fees (more outputs)
      // But we won't enforce strict ordering as fee calculation can vary
    }
  });
  
  test('should use recovery public key when provided', async () => {
    // Create a mock recovery public key (32 bytes for x-only key)
    const recoveryPublicKey = new Uint8Array(32).fill(0x02);
    
    const params: BatchCommitTransactionParams = {
      inscriptions: mockBatchInscriptions.slice(0, 1), // Just one for simplicity
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork,
      recoveryPublicKey
    };
    
    const result = await prepareBatchCommitTransaction(params);
    
    expect(result.inscriptions).toHaveLength(1);
    expect(result.inscriptions[0].commitAddress).toBeDefined();
    // The commit address should be different when using a recovery key
    // (though we can't easily test the exact difference without mocking deeper)
  });
  
  test('should generate sequential sat ranges correctly', async () => {
    const inscriptions: BatchInscriptionParams[] = [
      { content: 'A', contentType: 'text/plain', postage: 1000 },
      { content: 'B', contentType: 'text/plain', postage: 2000 },
      { content: 'C', contentType: 'text/plain', postage: 1500 },
      { content: 'D', contentType: 'text/plain', postage: 3000 }
    ];
    
    const params: BatchCommitTransactionParams = {
      inscriptions,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    const result = await prepareBatchCommitTransaction(params);
    
    // Verify ranges are sequential and match postage amounts
    expect(result.inscriptions[0].expectedSatRange).toEqual({ start: 0, end: 999 });
    expect(result.inscriptions[1].expectedSatRange).toEqual({ start: 1000, end: 2999 });
    expect(result.inscriptions[2].expectedSatRange).toEqual({ start: 3000, end: 4499 });
    expect(result.inscriptions[3].expectedSatRange).toEqual({ start: 4500, end: 7499 });
    
    // Verify postage amounts match
    expect(result.inscriptions[0].postage).toBe(1000);
    expect(result.inscriptions[1].postage).toBe(2000);
    expect(result.inscriptions[2].postage).toBe(1500);
    expect(result.inscriptions[3].postage).toBe(3000);
  });
});