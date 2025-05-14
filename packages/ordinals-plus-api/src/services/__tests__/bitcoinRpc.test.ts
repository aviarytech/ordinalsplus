import { BitcoinRpcService, P2TR_DUST_LIMIT_SATS } from '../bitcoinRpc';
import type { UTXO } from '../bitcoinRpc';
import {
  BASE_TX_OVERHEAD_VBYTES,
  P2TR_OUTPUT_VBYTES,
  P2TR_KEY_PATH_INPUT_VBYTES,
  estimateTxVBytes, // We might call this directly in tests to verify fee logic
} from '../../utils/txSizeEstimator';

describe('BitcoinRpcService', () => {
  let service: BitcoinRpcService;

  beforeEach(() => {
    service = new BitcoinRpcService();
  });

  describe('selectUtxos', () => {
    const feeRate = 10; // sats/vByte

    const utxo1: UTXO = { txid: 'tx1', vout: 0, value: 10000, scriptPubKey: 'spk1' }; // P2TR assumed by selectUtxos current logic
    const utxo2: UTXO = { txid: 'tx2', vout: 1, value: 5000, scriptPubKey: 'spk2' };
    const utxo3: UTXO = { txid: 'tx3', vout: 0, value: 7000, scriptPubKey: 'spk3' };
    const utxoLarge: UTXO = { txid: 'txL', vout: 0, value: 100000, scriptPubKey: 'spkL' };

    it('should select a single UTXO if it covers amount and fees with change', () => {
      const availableUtxos = [utxo1]; // 10000 sats
      const recipientAmountSats = 5000;
      const numOutputs = 1; // Recipient only

      // Expected size: 1 input, 2 outputs (recipient + change)
      // base (10.5) + 1*P2TR_IN (58) + 2*P2TR_OUT (2*31=62) = 10.5 + 58 + 62 = 130.5 vBytes => 131 vBytes
      const expectedVBytes = Math.ceil(BASE_TX_OVERHEAD_VBYTES + P2TR_KEY_PATH_INPUT_VBYTES + 2 * P2TR_OUTPUT_VBYTES);
      expect(expectedVBytes).toBe(131);
      const expectedFee = expectedVBytes * feeRate; // 131 * 10 = 1310 sats
      const totalNeeded = recipientAmountSats + expectedFee; // 5000 + 1310 = 6310 sats
      const expectedChange = utxo1.value - totalNeeded; // 10000 - 6310 = 3690 sats

      const result = service.selectUtxos({
        availableUtxos,
        recipientAmountSats,
        feeRateSatPerVByte: feeRate,
        numOutputs,
      });

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.selectedUtxos).toEqual([utxo1]);
      expect(result.totalInputAmountSats).toBe(utxo1.value);
      expect(result.estimatedFeeSats).toBe(expectedFee);
      expect(result.changeAmountSats).toBe(expectedChange);
      expect(result.needsChange).toBe(true);
      expect(result.estimatedTxVBytes).toBe(expectedVBytes);
    });

    it('should select multiple UTXOs if needed', () => {
      const availableUtxos = [utxo2, utxo1]; // 5k, 10k (sorted: 10k, 5k)
      const recipientAmountSats = 12000;
      const numOutputs = 1;

      // Try with utxo1 (10000 sats): Not enough for 12000 + fee
      // Add utxo2 (5000 sats). Total input = 15000
      // Expected size: 2 inputs, 2 outputs (recipient + change)
      // base (10.5) + 2*P2TR_IN (116) + 2*P2TR_OUT (62) = 10.5 + 116 + 62 = 188.5 => 189 vBytes
      const expectedVBytes = Math.ceil(BASE_TX_OVERHEAD_VBYTES + 2 * P2TR_KEY_PATH_INPUT_VBYTES + 2 * P2TR_OUTPUT_VBYTES);
      expect(expectedVBytes).toBe(189);
      const expectedFee = expectedVBytes * feeRate; // 189 * 10 = 1890 sats
      const totalNeeded = recipientAmountSats + expectedFee; // 12000 + 1890 = 13890 sats
      const expectedChange = (utxo1.value + utxo2.value) - totalNeeded; // 15000 - 13890 = 1110 sats

      const result = service.selectUtxos({
        availableUtxos,
        recipientAmountSats,
        feeRateSatPerVByte: feeRate,
        numOutputs,
      });

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.selectedUtxos).toEqual([utxo1, utxo2]); // Order of selection due to sort
      expect(result.totalInputAmountSats).toBe(utxo1.value + utxo2.value);
      expect(result.estimatedFeeSats).toBe(expectedFee);
      expect(result.changeAmountSats).toBe(expectedChange);
      expect(result.needsChange).toBe(true);
      expect(result.estimatedTxVBytes).toBe(expectedVBytes);
    });

    it('should return null if not enough UTXOs', () => {
      const availableUtxos = [utxo2]; // 5000 sats
      const recipientAmountSats = 6000;
      const numOutputs = 1;

      const result = service.selectUtxos({
        availableUtxos,
        recipientAmountSats,
        feeRateSatPerVByte: feeRate,
        numOutputs,
      });
      expect(result).toBeNull();
    });

    it('should handle selection where change is dust (no change output)', () => {
      const availableUtxos = [utxo3]; // 7000 sats
      const recipientAmountSats = 6500; // Needs 6500 + fee
      const numOutputs = 1;

      // Iteration 1 (with change): 
      // Size: 1 input, 2 outputs = 131 vBytes. Fee = 1310. Total = 6500 + 1310 = 7810. Inputs (7000) < 7810. Fails here.
      // The code logic: if (currentInputAmountSats >= totalRequiredWithChange)
      // This test setup is actually for the case where *even with a change output considered*, funds are insufficient.
      // Let's adjust: recipientAmount should be smaller so that `potentialChange` is calculated and found to be dust.
      // Target: Recipient 5000. utxo3 (7000).
      // Size (1 in, 2 out): 131 vBytes. Fee = 1310. Total = 5000 + 1310 = 6310.
      // Input (7000) >= 6310. PotentialChange = 7000 - 6310 = 690.
      // If P2TR_DUST_LIMIT_SATS is, say, 330. 690 >= 330. So this would create change.
      
      // Let's make potentialChange just below dust. Dust = 330.
      // Want: utxo.value - (recipient + fee_with_change) = DUST_LIMIT - 1
      // 7000 - (recipient + 1310) = 329 => 7000 - 1310 - 329 = recipient => recipient = 5361
      const recipientForDustCase = 5361;
      const initialFeeWithChange = 1310; // from 131vbytes * 10 rate
      const potentialChange = utxo3.value - (recipientForDustCase + initialFeeWithChange); // 7000 - (5361 + 1310) = 7000 - 6671 = 329
      expect(potentialChange).toBeLessThan(P2TR_DUST_LIMIT_SATS);
      expect(potentialChange).toBeGreaterThan(0);

      // Now, recalculate without change output:
      // Size (1 in, 1 out): base(10.5) + 1*P2TR_IN(58) + 1*P2TR_OUT(31) = 10.5 + 58 + 31 = 99.5 => 100 vBytes
      const vBytesNoChange = Math.ceil(BASE_TX_OVERHEAD_VBYTES + P2TR_KEY_PATH_INPUT_VBYTES + 1 * P2TR_OUTPUT_VBYTES);
      expect(vBytesNoChange).toBe(100);
      const feeNoChange = vBytesNoChange * feeRate; // 100 * 10 = 1000 sats
      // Total required no change = recipient + feeNoChange = 5361 + 1000 = 6361
      // Input (7000) >= 6361. This is true.
      // Actual fee paid = input - recipient = 7000 - 5361 = 1639.
      // This fee (1639) must be >= feeNoChange (1000). True.

      const result = service.selectUtxos({
        availableUtxos: [utxo3],
        recipientAmountSats: recipientForDustCase,
        feeRateSatPerVByte: feeRate,
        numOutputs,
      });

      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.selectedUtxos).toEqual([utxo3]);
      expect(result.totalInputAmountSats).toBe(utxo3.value);
      expect(result.estimatedFeeSats).toBe(1639); // Actual fee paid
      expect(result.changeAmountSats).toBe(0);
      expect(result.needsChange).toBe(false);
      expect(result.estimatedTxVBytes).toBe(vBytesNoChange);
    });

    it('should select UTXO that results in exact amount (no change, not dust)', () => {
      const recipientAmountSats = 6000;
      const numOutputs = 1; // recipient only
      // We need an input such that input_value = recipient + fee_for_tx_with_no_change
      // Tx size (1 input, 1 output): 100 vBytes. Fee = 100 * 10 = 1000.
      // So, input_value = 6000 + 1000 = 7000. utxo3 fits this.
      const exactUtxo: UTXO = { txid: 'txE', vout:0, value: 7000, scriptPubKey: 'spkE' };

      const result = service.selectUtxos({
        availableUtxos: [exactUtxo], 
        recipientAmountSats,
        feeRateSatPerVByte: feeRate,
        numOutputs
      });
      
      expect(result).not.toBeNull();
      if (!result) return;
      expect(result.selectedUtxos).toEqual([exactUtxo]);
      expect(result.totalInputAmountSats).toBe(7000);
      expect(result.estimatedFeeSats).toBe(1000); // 7000 - 6000
      expect(result.changeAmountSats).toBe(0);
      expect(result.needsChange).toBe(false);
      expect(result.estimatedTxVBytes).toBe(100); // Size for 1 input, 1 output
    });

    it('should select UTXOs when inscriptionDetails are provided', () => {
      const availableUtxos = [utxoLarge]; // 100,000 sats
      const recipientAmountSats = 5000;
      const numOutputs = 1; // Recipient
      const feeRate = 5; // Using a different fee rate for variety

      const inscriptionDetails = {
        contentType: 'text/plain',
        contentByteLength: 100, // ~100 byte script length
        metadataByteLength: 20,  // ~20 byte script length
        numOtherInscriptionWitnessVBytes: 18, // Approx vbytes for sig for a script path spend (e.g. 70WU/4 ~ 18vB)
      };

      // Calculate expected size of the inscription input part
      // This requires calling the actual estimator functions from txSizeEstimator
      // For simplicity in test, let's assume estimateTxVBytes correctly handles it.
      // We need to know the size of the transaction with:
      // 1 funding input (utxoLarge)
      // 1 inscription input (described by inscriptionDetails)
      // 2 outputs (recipient + change)

      // To get a more precise expectedVBytes for the test:
      const { estimateInscriptionEnvelopeVBytes, estimateP2TRScriptPathInputVBytes } = 
        jest.requireActual('../../utils/txSizeEstimator');

      const envelopeScriptLength = estimateInscriptionEnvelopeVBytes(
        inscriptionDetails.contentType,
        inscriptionDetails.contentByteLength,
        inscriptionDetails.metadataByteLength,
        undefined // no metaprotocol
      );
      const inscriptionInputVBytes = estimateP2TRScriptPathInputVBytes(
        inscriptionDetails.numOtherInscriptionWitnessVBytes,
        envelopeScriptLength,
        0 // controlBlockLeafDepth
      );

      // Tx: base + 1 P2TR funding input + inscription input + 2 P2TR outputs
      const expectedVBytesWithInscription = Math.ceil(
        BASE_TX_OVERHEAD_VBYTES +
        P2TR_KEY_PATH_INPUT_VBYTES + // For utxoLarge
        inscriptionInputVBytes +       // For the inscription
        2 * P2TR_OUTPUT_VBYTES       // Recipient + Change
      );

      const expectedFee = expectedVBytesWithInscription * feeRate;
      const totalNeeded = recipientAmountSats + expectedFee;
      const expectedChange = utxoLarge.value - totalNeeded;

      const result = service.selectUtxos({
        availableUtxos,
        recipientAmountSats,
        feeRateSatPerVByte: feeRate,
        numOutputs,
        inscriptionDetails,
      });

      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.selectedUtxos).toEqual([utxoLarge]);
      expect(result.totalInputAmountSats).toBe(utxoLarge.value);
      expect(result.estimatedTxVBytes).toBe(expectedVBytesWithInscription);
      expect(result.estimatedFeeSats).toBe(expectedFee);
      expect(result.changeAmountSats).toBe(expectedChange);
      expect(result.needsChange).toBe(true);
    });
  });
}); 