/**
 * Utility functions for estimating Bitcoin transaction sizes and calculating fees.
 * These estimations are based on standard Bitcoin transaction structures and
 * typical sizes for different types of inputs and outputs.
 */

/**
 * Bitcoin transaction sizes for different input and output types (in virtual bytes).
 * These are approximations and may vary slightly depending on the specific script structures.
 */
export const TX_SIZES = {
  // Transaction overhead - version, locktime, etc.
  OVERHEAD: 10.5,
  
  // Input sizes
  P2WPKH_INPUT: 68, // Native SegWit input (P2WPKH)
  P2PKH_INPUT: 148, // Legacy input (P2PKH)
  P2SH_P2WPKH_INPUT: 91, // Nested SegWit input (P2SH-P2WPKH)
  P2TR_INPUT: 57.5, // Taproot input (P2TR) - basic spend path
  
  // Output sizes
  P2WPKH_OUTPUT: 31, // Native SegWit output (P2WPKH)
  P2PKH_OUTPUT: 34, // Legacy output (P2PKH)
  P2SH_OUTPUT: 32, // P2SH output
  P2TR_OUTPUT: 43, // Taproot output (P2TR)
  
  // Ordinals-specific sizes
  P2TR_COMMIT_OUTPUT: 43, // Taproot commit output for ordinals
  REVEAL_CONTROL_BLOCK: 33, // Control block for a simple tapscript reveal
  REVEAL_BASE_WITNESS: 3, // Base witness items count
  
  // Minimum dust limit (in satoshis)
  DUST_LIMIT: 546
};

/**
 * Estimates the size of a commitment transaction in virtual bytes.
 * 
 * @param inputCount - Number of inputs in the transaction
 * @param outputCount - Number of outputs (including commit output and change if needed)
 * @param inputType - Type of inputs ("p2wpkh", "p2pkh", "p2sh-p2wpkh", "p2tr")
 * @returns Estimated transaction size in virtual bytes
 */
export function estimateCommitTxSize(
  inputCount: number,
  outputCount: number,
  inputType: 'p2wpkh' | 'p2pkh' | 'p2sh-p2wpkh' | 'p2tr' = 'p2wpkh'
): number {
  let inputSize: number;
  
  // Determine input size based on type
  switch (inputType) {
    case 'p2pkh':
      inputSize = TX_SIZES.P2PKH_INPUT;
      break;
    case 'p2sh-p2wpkh':
      inputSize = TX_SIZES.P2SH_P2WPKH_INPUT;
      break;
    case 'p2tr':
      inputSize = TX_SIZES.P2TR_INPUT;
      break;
    case 'p2wpkh':
    default:
      inputSize = TX_SIZES.P2WPKH_INPUT;
      break;
  }
  
  // One output will be the commit P2TR output, and others might be change outputs
  const outputSize = outputCount > 0 
    ? TX_SIZES.P2TR_COMMIT_OUTPUT + (outputCount - 1) * TX_SIZES.P2WPKH_OUTPUT
    : 0;
  
  return Math.ceil(TX_SIZES.OVERHEAD + (inputCount * inputSize) + outputSize);
}

/**
 * Estimates the size of a reveal transaction in virtual bytes.
 * This is more complex due to the tapscript witness data that contains the inscription.
 * 
 * @param inscriptionSizeBytes - Size of the inscription content in bytes
 * @param destinationOutputType - Type of destination output ("p2wpkh", "p2pkh", "p2sh", "p2tr")
 * @returns Estimated transaction size in virtual bytes
 */
export function estimateRevealTxSize(
  inscriptionSizeBytes: number,
  destinationOutputType: 'p2wpkh' | 'p2pkh' | 'p2sh' | 'p2tr' = 'p2wpkh'
): number {
  // Base tx size components
  const baseSize = TX_SIZES.OVERHEAD;
  const inputSize = 41; // Special commit input size
  
  // Determine output size based on type
  let outputSize: number;
  switch (destinationOutputType) {
    case 'p2pkh':
      outputSize = TX_SIZES.P2PKH_OUTPUT;
      break;
    case 'p2sh':
      outputSize = TX_SIZES.P2SH_OUTPUT;
      break;
    case 'p2tr':
      outputSize = TX_SIZES.P2TR_OUTPUT;
      break;
    case 'p2wpkh':
    default:
      outputSize = TX_SIZES.P2WPKH_OUTPUT;
      break;
  }
  
  // Witness components
  const controlBlockSize = TX_SIZES.REVEAL_CONTROL_BLOCK;
  const sigSize = 65; // Schnorr signature
  const inscriptionScriptSize = inscriptionSizeBytes + 15; // Additional bytes for script encoding and mime type
  const witnessItemsCount = TX_SIZES.REVEAL_BASE_WITNESS; // Base witness structure
  
  // Calculate witness vsize (witness data counts as 1/4 of its actual size in vbytes)
  const witnessSize = (witnessItemsCount + sigSize + inscriptionScriptSize + controlBlockSize) / 4;
  
  // Final vsize calculation
  return Math.ceil(baseSize + inputSize + outputSize + witnessSize);
}

/**
 * Estimates the total fees for both commit and reveal transactions.
 * 
 * @param commitTxSize - Estimated size of commit transaction in vbytes
 * @param revealTxSize - Estimated size of reveal transaction in vbytes
 * @param feeRate - Fee rate in satoshis per vbyte
 * @returns Object containing commit fee, reveal fee, and total fee
 */
export function estimateTotalFees(
  commitTxSize: number,
  revealTxSize: number,
  feeRate: number
): { commitFee: number; revealFee: number; totalFee: number } {
  const commitFee = Math.ceil(commitTxSize * feeRate);
  const revealFee = Math.ceil(revealTxSize * feeRate);
  
  return {
    commitFee,
    revealFee,
    totalFee: commitFee + revealFee
  };
}

/**
 * Estimates the minimum amount needed for the inscription (reveal fee + dust limit).
 * 
 * @param revealTxSize - Estimated size of the reveal transaction
 * @param feeRate - Fee rate in satoshis per vbyte
 * @returns Minimum amount needed in satoshis
 */
export function estimateMinimumInscriptionAmount(
  revealTxSize: number,
  feeRate: number
): number {
  const revealFee = Math.ceil(revealTxSize * feeRate);
  return revealFee + TX_SIZES.DUST_LIMIT;
} 