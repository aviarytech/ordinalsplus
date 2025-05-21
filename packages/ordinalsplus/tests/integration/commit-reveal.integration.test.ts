import { describe, test, expect } from 'bun:test';
import * as btc from '@scure/btc-signer';
import { KeyPairGenerator } from '../../src/key-management/key-pair-generator';
import { createTextInscription } from '../../src/inscription';
import { prepareCommitTransaction } from '../../src/transactions/commit-transaction';
import { signTransaction } from '../../src/transactions/transaction-signing';
import { createRevealTransaction } from '../../src/transactions/reveal-transaction';
import { Utxo } from '../../src/types';

// Integration test that builds a commit and reveal transaction pair
// ensuring both transactions are fully signed and ready for broadcast.

describe('Commit & Reveal Integration', () => {
  test('should create broadcastable commit and reveal transactions', async () => {
    // Generate funding key pair for P2WPKH input
    const fundingKey = KeyPairGenerator.generateSecp256k1KeyPair({ includeAddress: true, network: 'testnet' });
    const fundingAddress = fundingKey.address!;
    const fundingPayment = btc.p2wpkh(fundingKey.publicKeyCompressed, btc.TEST_NETWORK);

    // Mock UTXO used to fund the commit transaction
    const utxo: Utxo = {
      txid: 'aa'.repeat(32),
      vout: 0,
      value: 20_000,
      scriptPubKey: Buffer.from(fundingPayment.script).toString('hex'),
      script: { type: 'p2wpkh', address: fundingAddress }
    };

    // Prepare inscription and commit transaction
    const inscription = createTextInscription('Integration commit-reveal', 'testnet');
    const commitRes = await prepareCommitTransaction({
      inscription,
      utxos: [utxo],
      changeAddress: fundingAddress,
      feeRate: 1,
      network: 'testnet'
    });

    // Sign the commit transaction so it would be valid for broadcast
    const signedCommit = await signTransaction(commitRes.commitPsbt, {
      privateKey: fundingKey.privateKey,
      transactionType: 'COMMIT'
    });

    expect(signedCommit.tx.isFinal).toBe(true);
    expect(signedCommit.hex.length).toBeGreaterThan(0);

    // Build UTXO from commit output for the reveal transaction
    const commitOutput = signedCommit.tx.getOutput(0);
    const commitUtxo: Utxo = {
      txid: signedCommit.tx.id,
      vout: 0,
      value: Number(commitOutput.amount),
      script: { type: 'p2tr', address: inscription.commitAddress.address }
    };

    // Create and sign the reveal transaction using the inscription key
    // Mock network calls used by system health check
    (globalThis as any).fetch = async () => ({ ok: true });
    const revealRes = await createRevealTransaction({
      selectedUTXO: commitUtxo,
      preparedInscription: inscription,
      feeRate: 1,
      network: btc.TEST_NETWORK,
      privateKey: inscription.revealPrivateKey!,
      commitTransactionId: signedCommit.tx.id
    });

    expect(revealRes.tx.isFinal).toBe(true);
    expect(revealRes.hex.length).toBeGreaterThan(0);

    // Verify reveal spends the exact script produced in the commit output
    const commitScriptHex = Buffer.from(commitOutput.script).toString('hex');
    const revealInput = revealRes.tx.getInput(0);
    const revealScriptHex = Buffer.from(revealInput.witnessUtxo!.script).toString('hex');
    expect(revealScriptHex).toBe(commitScriptHex);
  });
});
