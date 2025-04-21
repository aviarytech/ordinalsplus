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
    
    // Ensure we deal with whole numbers for satoshis
    const calculatedFee = Math.ceil(txSizeBytes * feeRateSatsPerVb);
    
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