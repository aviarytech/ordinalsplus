import {
  estimateTxVBytes,
  P2TR_OUTPUT_VBYTES,
  P2TR_KEY_PATH_INPUT_VBYTES,
} from '../utils/txSizeEstimator';

export interface UTXO {
  txid: string;
  vout: number;
  value: number; // in satoshis
  scriptPubKey: string; // hex string of the scriptPubKey
  address?: string; // Optional address associated with the UTXO
  type?: 'P2TR' | 'P2WPKH' | 'P2SH-P2WPKH' | 'P2PKH'; // Optional, to help with size estimation if varied
}

export interface SelectUtxosParams {
  availableUtxos: UTXO[];
  recipientAmountSats: number; // The amount to be sent to the primary recipient(s)
  feeRateSatPerVByte: number;
  // Details for the inscription input, if one is being spent (e.g., for BRC-20 transfer)
  // If this is for a fresh mint, this might be undefined or handled differently.
  // For simplicity, assuming this function selects regular UTXOs to pay for a new inscription
  // or a general transaction.
  inscriptionDetails?: {
    contentType: string;
    contentByteLength: number;
    metadataByteLength: number;
    metaprotocol?: string;
    numOtherInscriptionWitnessVBytes: number;
  };
  // Number of non-change outputs (e.g., recipient, inscription postage if separate)
  numOutputs: number; 
  // Address where change should be sent. If not provided, selection might fail or assume one of the input addresses.
  changeAddress?: string; 
}

export interface SelectUtxosResult {
  selectedUtxos: UTXO[];
  totalInputAmountSats: number;
  estimatedFeeSats: number;
  changeAmountSats: number;
  estimatedTxVBytes: number;
  needsChange: boolean;
}

// A typical dust limit for P2TR outputs. (e.g., 31 vBytes * 1 sat/vByte = 31 sats, but often higher, e.g. 330 or 546)
// Using a conservative value based on common practice. This might need adjustment based on network conditions or policy.
export const P2TR_DUST_LIMIT_SATS = 330; 

export class BitcoinRpcService {
  constructor() {
    // In a real scenario, this might take an RPC client instance
  }

  /**
   * Selects UTXOs to cover a target amount plus fees.
   * Implements a greedy algorithm: sorts UTXOs by value and picks until amount is covered.
   * This is a simplified version and might not be optimal for all scenarios (e.g., dust avoidance, minimizing inputs).
   */
  public selectUtxos(params: SelectUtxosParams): SelectUtxosResult | null {
    const {
      availableUtxos,
      recipientAmountSats,
      feeRateSatPerVByte,
      inscriptionDetails,
      numOutputs,
      // changeAddress, // Placeholder for now
    } = params;

    // Sort UTXOs: smallest first to consolidate, or largest first to minimize inputs.
    // For fee optimization with iterative size calculation, starting with smaller UTXOs that
    // closely match the target can sometimes be better. However, a common greedy approach
    // is largest-first to reduce input count quickly. Let's try largest-first.
    // Or, a more complex strategy: "smallest-larger-than-target-first" or "branch and bound".
    // For now, simple value sort: largest first.
    const sortedUtxos = [...availableUtxos].sort((a, b) => b.value - a.value);

    let selectedUtxos: UTXO[] = [];
    let currentInputAmountSats = 0;
    let estimatedTxVBytes = 0;
    let estimatedFeeSats = 0;

    // Iteratively select UTXOs
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo);
      currentInputAmountSats += utxo.value;

      // Recalculate size and fee with current inputs and assuming a change output might be needed.
      let numEffectiveOutputsWithChange = numOutputs + 1;
      let vBytesWithChange = estimateTxVBytes(
        selectedUtxos.length, 
        numEffectiveOutputsWithChange, 
        inscriptionDetails
      );
      let feeWithChange = Math.ceil(vBytesWithChange * feeRateSatPerVByte);
      let totalRequiredWithChange = recipientAmountSats + feeWithChange;

      if (currentInputAmountSats >= totalRequiredWithChange) {
        // We have enough to cover recipient + fee for a tx *with* a change output.
        let potentialChange = currentInputAmountSats - totalRequiredWithChange;

        if (potentialChange >= P2TR_DUST_LIMIT_SATS) {
          // Change is substantial, keep it.
          return {
            selectedUtxos,
            totalInputAmountSats: currentInputAmountSats,
            estimatedFeeSats: feeWithChange,
            changeAmountSats: potentialChange,
            estimatedTxVBytes: vBytesWithChange,
            needsChange: true,
          };
        } else {
          // Change is dust or zero. We will not have a change output.
          // All excess (currentInputAmountSats - recipientAmountSats) will go to fees.
          // Recalculate size and fee *without* a change output.
          let numEffectiveOutputsNoChange = numOutputs;
          let vBytesNoChange = estimateTxVBytes(
            selectedUtxos.length, 
            numEffectiveOutputsNoChange, 
            inscriptionDetails
          );
          let feeNoChange = Math.ceil(vBytesNoChange * feeRateSatPerVByte);
          let totalRequiredNoChange = recipientAmountSats + feeNoChange;

          // Now, check if the current inputs cover this new total (recipient + fee_without_change).
          // The entire amount (currentInputAmountSats - recipientAmountSats) effectively becomes the fee,
          // as long as it's >= the calculated feeNoChange.
          if (currentInputAmountSats >= totalRequiredNoChange) {
            // Yes, inputs cover the cost without a change output.
            // The actual fee paid will be currentInputAmountSats - recipientAmountSats.
            // This must be at least feeNoChange for the transaction to be valid at the given fee rate.
            const actualFeePaid = currentInputAmountSats - recipientAmountSats;
            
            // We must ensure the actual fee paid is not less than the fee required for the smaller tx.
            // And it should not be excessively higher than necessary (though greedy selection might do that).
            // For UTXO selection, we are satisfied if actualFeePaid >= feeNoChange.
            if (actualFeePaid >= feeNoChange) {
                 return {
                    selectedUtxos,
                    totalInputAmountSats: currentInputAmountSats,
                    estimatedFeeSats: actualFeePaid, // The actual fee is all the remainder
                    changeAmountSats: 0,
                    estimatedTxVBytes: vBytesNoChange, // Tx size without change output
                    needsChange: false,
                };
            } else {
                // This case implies that `feeNoChange` (calculated for a smaller tx)
                // is LARGER than `currentInputAmountSats - recipientAmountSats`.
                // This means `currentInputAmountSats - recipientAmountSats < feeNoChange`
                // which is `currentInputAmountSats < recipientAmountSats + feeNoChange`
                // This means we don't have enough for the no-change option. Continue accumulating.
                // This state should ideally not be hit if the outer `currentInputAmountSats >= totalRequiredWithChange` was true
                // and `feeNoChange < feeWithChange`.
                // It suggests that `potentialChange` was positive but less than dust, yet `currentInputAmountSats - recipientAmountSats` is not enough to cover `feeNoChange`.
                // This condition means: `totalRequiredWithChange <= currentInputAmountSats < totalRequiredNoChange` AND `potentialChange < DUST`
                // Essentially, we can afford the tx with change (but change is dust), but cannot afford the tx without change (because fee without change is still too high relative to inputs minus recipient).
                // This seems like a scenario where more UTXOs are needed. The loop will continue.
            }
          } else {
            // Not enough even for the no-change option. Continue accumulating.
            // This happens if `currentInputAmountSats < recipientAmountSats + feeNoChange`.
          }
        }
      } // If currentInputAmountSats < totalRequiredWithChange, loop continues to add more UTXOs.
    }

    // If loop finishes and not enough funds, selection failed.
    return null; 
  }
}

// Example Usage (for testing, to be removed or moved to tests)
/*
const service = new BitcoinRpcService();
const dummyUtxos: UTXO[] = [
  { txid: 'tx1', vout: 0, value: 10000, scriptPubKey: 'dummy', type: 'P2TR' },
  { txid: 'tx2', vout: 1, value: 5000, scriptPubKey: 'dummy', type: 'P2TR' },
  { txid: 'tx3', vout: 0, value: 12000, scriptPubKey: 'dummy', type: 'P2TR' },
  { txid: 'tx4', vout:0, value: 2000, scriptPubKey: 'dummy', type: 'P2TR'}
];

const selection = service.selectUtxos({
  availableUtxos: dummyUtxos,
  recipientAmountSats: 10000,
  feeRateSatPerVByte: 2,
  numOutputs: 1, // Just the recipient
});

if (selection) {
  console.log('Selected UTXOs:', selection.selectedUtxos.map(u => u.value));
  console.log('Total Input (sats):', selection.totalInputAmountSats);
  console.log('Estimated Fee (sats):', selection.estimatedFeeSats);
  console.log('Change (sats):', selection.changeAmountSats);
  console.log('Needs Change:', selection.needsChange);
  console.log('Estimated VBytes:', selection.estimatedTxVBytes);
} else {
  console.log('UTXO selection failed.');
}
*/ 