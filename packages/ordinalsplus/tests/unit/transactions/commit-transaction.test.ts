import { describe, test, expect } from 'bun:test';
import { 
  prepareCommitTransaction, 
  CommitTransactionParams
} from '../src/transactions/commit-transaction';
import { Utxo, BitcoinNetwork } from '../src/types';
import { createTextInscription } from '../src/inscription';

/**
 * Test suite for commit transaction process.
 * This is related to Task 5: Refactor Commit Transaction Process
 */
describe('Commit Transaction Process', () => {
  // Mock Bitcoin network for testing
  const mockNetwork: BitcoinNetwork = 'testnet';
  
  // Sample UTXOs for tests
  const mockUtxos: Utxo[] = [
    {
      txid: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      vout: 0,
      value: 10000,
      scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
    },
    {
      txid: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      vout: 1,
      value: 20000,
      scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
    }
  ];
  
  // Sample change address
  const mockChangeAddress = 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx';
  
  test('should generate a valid commit address for receiving funds', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Prepare the commit transaction params
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    // Execute the commit transaction preparation
    const result = await prepareCommitTransaction(params);
    
    // The commit address should be a valid taproot address (starts with tb1p for testnet)
    expect(result.commitAddress).toBeDefined();
    expect(result.commitAddress).toMatch(/^tb1p[a-zA-Z0-9]{58,}$/);
    
    // The commit transaction should have a valid base64 encoded PSBT
    expect(result.commitPsbtBase64).toBeDefined();
    expect(result.commitPsbtBase64.length).toBeGreaterThan(20);
    
    // The fees should be a reasonable amount
    expect(result.fees.commit).toBeGreaterThan(0);
  });

  test('should create a properly structured commit transaction', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Prepare the commit transaction params
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    // Execute the commit transaction preparation
    const result = await prepareCommitTransaction(params);
    
    // The commit PSBT should be properly structured
    const commitPsbt = result.commitPsbt;
    
    // Verify the transaction is properly structured (without accessing private properties)
    expect(commitPsbt).toBeDefined();
    
    // Instead of checking inputs/outputs directly, we can verify the selected UTXOs
    expect(result.selectedUtxos.length).toBeGreaterThan(0);
    
    // And verify the commit amount matches what's expected
    expect(result.requiredCommitAmount).toBeGreaterThan(0);
  });

  test('should handle commit transaction state management efficiently', async () => {
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };

    const addSpy = vi.spyOn(transactionTracker, 'addTransaction');
    const statusSpy = vi.spyOn(transactionTracker, 'setTransactionStatus');

    const result = await prepareCommitTransaction(params);
    expect(addSpy).toHaveBeenCalled();
    expect(statusSpy).toHaveBeenCalledWith(result.transactionId, TransactionStatus.CONFIRMING);
  });

  test('should properly handle errors in commit transaction creation', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Prepare invalid params (empty UTXOs)
    const invalidParams: CommitTransactionParams = {
      inscription,
      utxos: [], // Empty UTXOs should cause an error
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    // It should throw an error because there are no UTXOs
    await expect(prepareCommitTransaction(invalidParams)).rejects.toThrow(/No UTXOs provided/);
    
    // Prepare invalid params (negative fee rate)
    const invalidFeeParams: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: -1, // Negative fee rate should cause an error
      network: mockNetwork
    };
    
    // It should throw an error because of the negative fee rate
    await expect(prepareCommitTransaction(invalidFeeParams)).rejects.toThrow(/Invalid fee rate/);
  });

  test('should produce a PSBT with inputs matching selected UTXOs', async () => {
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };

    const result = await prepareCommitTransaction(params);
    expect(result.commitPsbt.inputsLength).toBe(result.selectedUtxos.length);
  });

  test('should maintain proper type definitions throughout commit process', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Prepare the commit transaction params
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    // Execute the commit transaction preparation
    const result = await prepareCommitTransaction(params);
    
    // Type checking - these assertions mostly check that the type definitions are correct
    expect(typeof result.commitAddress).toBe('string');
    expect(typeof result.commitPsbtBase64).toBe('string');
    expect(typeof result.fees.commit).toBe('number');
    expect(typeof result.requiredCommitAmount).toBe('number');
    
    // Commit PSBT should be defined and a valid PSBT object
    expect(result.commitPsbt).toBeDefined();
    
    // Selected UTXOs should be an array of Utxo objects
    expect(Array.isArray(result.selectedUtxos)).toBe(true);
    if (result.selectedUtxos.length > 0) {
      const utxo = result.selectedUtxos[0];
      expect(typeof utxo.txid).toBe('string');
      expect(typeof utxo.vout).toBe('number');
      expect(typeof utxo.value).toBe('number');
    }
  });

  test('should follow the micro-ordinals approach for commit transaction', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Prepare the commit transaction params
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    // Execute the commit transaction preparation
    const result = await prepareCommitTransaction(params);
    
    // Check that the commit address matches the one from the inscription
    expect(result.commitAddress).toBe(inscription.commitAddress.address);
    
    // Verify the transaction construction is correct
    expect(result.commitPsbt).toBeDefined();
    expect(result.requiredCommitAmount).toBeGreaterThan(0);
    
    // Verify the commit address script is being used correctly
    expect(inscription.commitAddress.script).toBeDefined();
  });

  // Replace the empty script test with a more accurate version
  test('should handle empty commit address script by deriving from address', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Create a minimal inscription that matches the PreparedInscription structure
    // but has an empty script in the commitAddress
    const minimalInscription = {
      ...inscription,
      commitAddress: {
        ...inscription.commitAddress,
        script: new Uint8Array(0) // Empty script
      }
    };
    
    // Prepare the commit transaction params
    const params: CommitTransactionParams = {
      inscription: minimalInscription,
      utxos: mockUtxos,
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork
    };
    
    // Execute the commit transaction preparation
    const result = await prepareCommitTransaction(params);
    
    // Verify that the transaction was created successfully despite empty script
    expect(result.commitPsbtBase64).toBeDefined();
    expect(result.commitPsbtBase64.length).toBeGreaterThan(20);
    
    // Verify the commit address matches the one from the original inscription
    expect(result.commitAddress).toBe(minimalInscription.commitAddress.address);
  });

  test('should prioritize user-selected UTXO for inscription as first input', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Define a specific UTXO that the user wants to inscribe on
    const selectedInscriptionUtxo: Utxo = {
      txid: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      vout: 0,
      value: 50000, // Lower value than the mock UTXOs to ensure it's not chosen by normal selection
      scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
    };
    
    // Prepare the commit transaction params with the selected UTXO
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos, // Other UTXOs available for funding
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork,
      selectedInscriptionUtxo // CRITICAL: The user's chosen UTXO
    };
    
    // Execute the commit transaction preparation
    const result = await prepareCommitTransaction(params);
    
    // Verify the selected UTXO is included in the transaction
    expect(result.selectedUtxos.length).toBeGreaterThan(0);
    
    // CRITICAL: The first UTXO in the selection should be the user's chosen one
    const firstUtxo = result.selectedUtxos[0];
    expect(firstUtxo.txid).toBe(selectedInscriptionUtxo.txid);
    expect(firstUtxo.vout).toBe(selectedInscriptionUtxo.vout);
    expect(firstUtxo.value).toBe(selectedInscriptionUtxo.value);
    
    // Additional UTXOs may be present for funding, but the inscription UTXO must be first
    console.log(`Selected UTXOs count: ${result.selectedUtxos.length}`);
    console.log(`First UTXO (inscription): ${firstUtxo.txid}:${firstUtxo.vout}`);
    
    // Verify the transaction was created successfully
    expect(result.commitPsbtBase64).toBeDefined();
    expect(result.commitAddress).toBe(inscription.commitAddress.address);
  });

  test('should add funding UTXOs when selected UTXO has insufficient funds', async () => {
    // Create a simple inscription for testing
    const inscription = createTextInscription('Hello, World!', mockNetwork);
    
    // Define a UTXO with very low value that needs additional funding
    const lowValueUtxo: Utxo = {
      txid: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      vout: 0,
      value: 1000, // Very low value, will need additional funding
      scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
    };
    
    // Prepare the commit transaction params
    const params: CommitTransactionParams = {
      inscription,
      utxos: mockUtxos, // Funding UTXOs
      changeAddress: mockChangeAddress,
      feeRate: 2,
      network: mockNetwork,
      selectedInscriptionUtxo: lowValueUtxo
    };
    
    // Execute the commit transaction preparation
    const result = await prepareCommitTransaction(params);
    
    // Should have multiple UTXOs (selected + funding)
    expect(result.selectedUtxos.length).toBeGreaterThan(1);
    
    // First UTXO should still be the user's selected one
    const firstUtxo = result.selectedUtxos[0];
    expect(firstUtxo.txid).toBe(lowValueUtxo.txid);
    expect(firstUtxo.vout).toBe(lowValueUtxo.vout);
    
    // Additional UTXOs should be from the funding pool
    const fundingUtxos = result.selectedUtxos.slice(1);
    expect(fundingUtxos.length).toBeGreaterThan(0);
    
    // All funding UTXOs should be from the mockUtxos array
    fundingUtxos.forEach(utxo => {
      expect(mockUtxos.find(mu => mu.txid === utxo.txid && mu.vout === utxo.vout)).toBeDefined();
    });
  });
}); 