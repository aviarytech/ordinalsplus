import { describe, expect, test } from '@jest/globals';
import { 
    selectUtxos, 
    selectUtxosForPayment, 
    selectResourceUtxo, 
    tagResourceUtxos,
    estimateTransactionSize,
    calculateFee
} from '../src/transactions/utxo-selection';
import { ResourceUtxo } from '../src/types/ordinals';

// Sample UTXOs for testing
const mockUtxos: ResourceUtxo[] = [
  {
    txid: 'abc123',
    vout: 0,
    value: 10000, // 10,000 sats
    scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d',
    hasResource: false
  },
  {
    txid: 'def456',
    vout: 1,
    value: 20000, // 20,000 sats
    scriptPubKey: '0014abcdef1234567890abcdef1234567890abcdef12',
    hasResource: true,
    resourceId: 'resource1'
  },
  {
    txid: 'ghi789',
    vout: 0,
    value: 50000, // 50,000 sats
    scriptPubKey: '00147890abcdef1234567890abcdef1234567890abcd',
    hasResource: false
  },
  {
    txid: 'jkl012',
    vout: 2,
    value: 5000, // 5,000 sats
    scriptPubKey: '0014234567890abcdef1234567890abcdef1234567d',
    hasResource: true,
    resourceId: 'resource2'
  },
  {
    txid: 'mno345',
    vout: 1,
    value: 100000, // 100,000 sats
    scriptPubKey: '00145678901234567890abcdef1234567890abcdef12',
    hasResource: false
  }
];

describe('Transaction Size and Fee Estimation', () => {
  test('Estimates transaction size correctly', () => {
    const size = estimateTransactionSize(2, 2);
    expect(size).toBe(10 + (2 * 68) + (2 * 31)); // 10 + 136 + 62 = 208
  });

  test('Calculates fee correctly', () => {
    const fee = calculateFee(208, 5);
    expect(fee).toBe(1040); // 208 * 5 = 1040
  });
});

describe('UTXO Selection', () => {
  test('Selects appropriate UTXOs for a payment', () => {
    const result = selectUtxosForPayment(mockUtxos, 30000, 5);
    
    // It should select a non-resource UTXO that covers the amount plus fee
    expect(result.selectedUtxos).toHaveLength(1);
    expect(result.selectedUtxos[0].txid).toBe('mno345');
    expect(result.selectedUtxos[0].hasResource).toBeFalsy();
  });

  test('Never selects resource UTXOs for payment', () => {
    // Create a scenario where only resource UTXOs are available
    const onlyResourceUtxos = mockUtxos.filter(utxo => utxo.hasResource);
    
    // Attempting to select UTXOs for payment should throw an error
    expect(() => selectUtxosForPayment(onlyResourceUtxos, 1000, 5))
      .toThrow('All available UTXOs contain resources and cannot be used for fees/payments');
  });

  test('Can select a specific resource UTXO', () => {
    const resourceUtxo = selectResourceUtxo(mockUtxos, 'resource2');
    
    expect(resourceUtxo).not.toBeNull();
    expect(resourceUtxo?.txid).toBe('jkl012');
    expect(resourceUtxo?.resourceId).toBe('resource2');
  });

  test('Returns null when requesting non-existent resource', () => {
    const resourceUtxo = selectResourceUtxo(mockUtxos, 'nonexistent');
    expect(resourceUtxo).toBeNull();
  });

  test('Can tag UTXOs based on resource data', () => {
    const untaggedUtxos: ResourceUtxo[] = [
      {
        txid: 'abc123',
        vout: 0,
        value: 10000,
        scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d'
      },
      {
        txid: 'def456',
        vout: 1,
        value: 20000,
        scriptPubKey: '0014abcdef1234567890abcdef1234567890abcdef12'
      }
    ];

    const resourceData = {
      'def456:1': true
    };

    const taggedUtxos = tagResourceUtxos(untaggedUtxos, resourceData);
    
    expect(taggedUtxos[0].hasResource).toBeFalsy();
    expect(taggedUtxos[1].hasResource).toBeTruthy();
  });

  test('Selects multiple UTXOs when needed', () => {
    // Request an amount that requires combining multiple UTXOs
    const result = selectUtxos(mockUtxos, {
      requiredAmount: 130000, // Requires more than the largest single UTXO (100,000)
      feeRate: 5,
      allowResourceUtxos: false
    });
    
    // Now it should select multiple UTXOs
    expect(result.selectedUtxos.length).toBeGreaterThan(1);
    expect(result.totalSelectedValue).toBeGreaterThanOrEqual(130000 + result.estimatedFee);
    
    // Verify no resource UTXOs were selected
    for (const utxo of result.selectedUtxos) {
      expect(utxo.hasResource).toBeFalsy();
    }
  });

  test('Can allow resource UTXOs when explicitly permitted', () => {
    // Create a scenario where we need both resource and non-resource UTXOs
    const result = selectUtxos(mockUtxos, {
      requiredAmount: 150000, // More than all non-resource UTXOs combined
      feeRate: 5,
      allowResourceUtxos: true // Allow using resource UTXOs
    });
    
    // Check that at least one resource UTXO was selected
    const hasResourceUtxo = result.selectedUtxos.some(utxo => utxo.hasResource);
    expect(hasResourceUtxo).toBeTruthy();
  });

  test('Throws error when insufficient funds', () => {
    expect(() => selectUtxos(mockUtxos, {
      requiredAmount: 1000000, // More than all UTXOs combined
      feeRate: 5
    })).toThrow('Insufficient funds');
  });

  test('Respects avoidUtxoIds option', () => {
    // Fix by using a low enough required amount that can be handled by the smaller UTXOs
    const result = selectUtxos(mockUtxos, {
      requiredAmount: 5000, // Small enough to be covered by abc123 UTXO
      feeRate: 5,
      avoidUtxoIds: ['mno345:1', 'ghi789:0'] // Avoid the largest non-resource UTXOs
    });
    
    // The largest UTXO should not be selected
    const selectedIds = result.selectedUtxos.map(utxo => `${utxo.txid}:${utxo.vout}`);
    expect(selectedIds).not.toContain('mno345:1');
    expect(selectedIds).not.toContain('ghi789:0');
  });
}); 