// Define minimum relay fee rate (sats/vB)
// Increased slightly from Bitcoin Core default of 1.0 for safety
const MIN_RELAY_FEE_RATE = 1.1; 

/**
 * Calculate transaction fee based on vbytes and fee rate, ensuring minimum relay fee.
 * 
 * @param vbytes - The virtual size of the transaction.
 * @param feeRate - The desired fee rate in sats/vbyte.
 * @returns The calculated fee in satoshis (bigint).
 */
export const calculateFee = (vbytes: number, feeRate: number): bigint => {
    // Ensure inputs are valid numbers
    if (isNaN(vbytes) || vbytes <= 0 || isNaN(feeRate) || feeRate <= 0) {
        console.warn(`[calculateFee] Invalid input: vbytes=${vbytes}, feeRate=${feeRate}. Returning 0.`);
        return 0n;
    }

    // Calculate fee based on the desired fee rate
    const calculatedFee = Math.ceil(vbytes * feeRate);
    
    // Calculate the minimum fee required for relay
    const minimumFee = Math.ceil(vbytes * MIN_RELAY_FEE_RATE);
    
    // Return the higher of the calculated fee or minimum relay fee
    // Ensure the result is a positive integer (minimum 1 sat)
    const finalFee = BigInt(Math.max(1, calculatedFee, minimumFee)); 
    
    return finalFee;
}; 