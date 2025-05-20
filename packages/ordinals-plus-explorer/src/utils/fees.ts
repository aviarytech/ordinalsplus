import { 
  estimateCommitTxSize, 
  estimateRevealTxSize, 
  estimateTotalFees, 
  estimateMinimumInscriptionAmount,
  TX_SIZES
} from './transactionSize';

/**
 * Fee rate levels for different transaction priority.
 */
export enum FeeRateLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high'
}

/**
 * Calculates the estimated transaction fee.
 * 
 * @param txSizeBytes - The estimated size of the transaction in virtual bytes (vB).
 * @param feeRateSatsPerVb - The chosen fee rate in satoshis per virtual byte.
 * @returns The estimated total fee in satoshis.
 */
export const calculateFee = (txSizeBytes: number | undefined | null, feeRateSatsPerVb: number | undefined | null): number | null => {
    if (txSizeBytes === undefined || txSizeBytes === null || txSizeBytes <= 0 || 
        feeRateSatsPerVb === undefined || feeRateSatsPerVb === null || feeRateSatsPerVb < 0) {
        return null; // Return null if inputs are invalid or missing
    }
    
    // Ensure we deal with whole numbers for satoshis and add a small buffer (2 sats) to avoid min relay fee issues
    const calculatedFee = Math.ceil(txSizeBytes * feeRateSatsPerVb) + 2;
    
    return calculatedFee;
};

/**
 * Formats a fee amount (in satoshis) into a more readable string (e.g., "1,234 sats").
 * 
 * @param feeInSats - The fee amount in satoshis.
 * @returns A formatted string representation of the fee, or an empty string if input is invalid.
 */
export const formatFee = (feeInSats: number | null): string => {
    if (feeInSats === null || feeInSats < 0) {
        return '';
    }
    
    // Format with commas for thousands separators
    return `${feeInSats.toLocaleString()} sats`;
};

/**
 * Estimates the fees required for a bitcoin ordinal inscription.
 * 
 * @param inscriptionSizeBytes - Size of the content to inscribe (in bytes)
 * @param commitInputCount - Number of inputs in the commit transaction
 * @param feeRate - Fee rate in satoshis per vbyte
 * @param includeChange - Whether the commit transaction includes a change output
 * @param destinationOutputType - Type of the output address for the reveal transaction
 * @returns An object containing breakdown of fees and size estimates
 */
export const estimateInscriptionFees = (
  inscriptionSizeBytes: number,
  commitInputCount: number = 1,
  feeRate: number,
  includeChange: boolean = true,
  destinationOutputType: 'p2wpkh' | 'p2pkh' | 'p2sh' | 'p2tr' = 'p2wpkh'
): {
  commitTxSize: number;
  revealTxSize: number;
  commitFee: number;
  revealFee: number;
  totalFee: number;
  minimumRequiredAmount: number;
} | null => {
  try {
    if (inscriptionSizeBytes <= 0 || feeRate <= 0 || commitInputCount <= 0) {
      return null;
    }

    // Calculate transaction sizes
    const commitOutputCount = includeChange ? 2 : 1; // Commit output + optional change
    const commitTxSize = estimateCommitTxSize(commitInputCount, commitOutputCount);
    const revealTxSize = estimateRevealTxSize(inscriptionSizeBytes, destinationOutputType);

    // Calculate fees
    const { commitFee, revealFee, totalFee } = estimateTotalFees(commitTxSize, revealTxSize, feeRate);
    
    // Minimum amount needed for the inscription
    const minimumRequiredAmount = revealFee + TX_SIZES.DUST_LIMIT;

    return {
      commitTxSize,
      revealTxSize,
      commitFee,
      revealFee,
      totalFee,
      minimumRequiredAmount
    };
  } catch (error) {
    console.error('Error estimating inscription fees:', error);
    return null;
  }
};

/**
 * Gets a fee rate based on the selected priority level.
 * 
 * @param feeRates - Object containing fee rates for different levels (fastestFee, halfHourFee, hourFee)
 * @param level - Desired fee rate level (high, medium, low)
 * @param manualRate - Optional manual rate that overrides the level if provided and valid
 * @returns The selected fee rate in sats/vB, or null if unavailable
 */
export const getSelectedFeeRate = (
  feeRates: { fastestFee?: number; halfHourFee?: number; hourFee?: number; } | null,
  level: FeeRateLevel = FeeRateLevel.MEDIUM,
  manualRate?: string | number
): number | null => {
  // First check if a valid manual rate was provided
  if (manualRate !== undefined) {
    const parsedRate = typeof manualRate === 'string' ? parseFloat(manualRate) : manualRate;
    if (!isNaN(parsedRate) && parsedRate > 0) {
      return parsedRate;
    }
  }

  // If no fee rates are available, return null
  if (!feeRates) {
    return null;
  }

  // Select based on priority level
  switch (level) {
    case FeeRateLevel.HIGH:
      return feeRates.fastestFee || null;
    case FeeRateLevel.MEDIUM:
      return feeRates.halfHourFee || null;
    case FeeRateLevel.LOW:
      return feeRates.hourFee || null;
    default:
      return feeRates.halfHourFee || null; // Default to medium priority
  }
};

// Re-export the transaction size estimation functions
export {
  estimateCommitTxSize,
  estimateRevealTxSize,
  estimateTotalFees,
  estimateMinimumInscriptionAmount,
  TX_SIZES
}; 