import { describe, test, expect } from 'bun:test';
import { createSimpleCommitTransaction, createSimpleRevealTransaction } from '../../src/transactions/simple';
import { createTextInscription } from '../../src/inscription';
import type { Utxo } from '../../src/types';
import * as btc from '@scure/btc-signer';

const mockUtxo: Utxo = {
  txid: 'a'.repeat(64),
  vout: 0,
  value: 10000,
  scriptPubKey: '0014d85c2b71d0060b09c9886aeb815e50991dda124d',
  script: { type: 'p2wpkh', address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx' }
};

describe('simple commit and reveal', () => {
  test('createSimpleCommitTransaction returns psbt', async () => {
    const inscription = createTextInscription('hi', 'testnet');
    const result = await createSimpleCommitTransaction({
      inscription,
      utxo: mockUtxo,
      changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      feeRate: 2,
      network: 'testnet'
    });
    expect(result.commitAddress).toBe(inscription.commitAddress.address);
    expect(result.commitPsbtBase64).toBeDefined();
  });

  test('createSimpleRevealTransaction returns tx', async () => {
    const inscription = createTextInscription('hi', 'testnet');
    const commitRes = await createSimpleCommitTransaction({
      inscription,
      utxo: mockUtxo,
      changeAddress: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      feeRate: 2,
      network: 'testnet'
    });
    const revealUtxo: Utxo = {
      txid: 'b'.repeat(64),
      vout: 0,
      value: 2000,
      script: { type: 'p2tr', address: commitRes.commitAddress }
    } as any;
    const result = await createSimpleRevealTransaction({
      utxo: revealUtxo,
      preparedInscription: inscription,
      feeRate: 2,
      network: 'testnet',
      privateKey: inscription.revealPrivateKey as Uint8Array
    });
    expect(result.tx).toBeInstanceOf(btc.Transaction);
  });
});
