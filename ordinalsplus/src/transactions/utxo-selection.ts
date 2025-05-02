import { ResourceUtxo, UtxoSelectionOptions, UtxoSelectionResult } from '../types/ordinals';

// Minimum dust limit for Bitcoin outputs (546 satoshis)
const MIN_DUST_LIMIT = 546;

/**
 * Estimates transaction size in vbytes based on input and output counts
 * This is a simplified calculation, and actual size may vary based on script types
 * 
 * @param inputCount Number of inputs in the transaction
 * @param outputCount Number of outputs in the transaction
 * @returns Estimated transaction size in vbytes
 */
export function estimateTransactionSize(inputCount: number, outputCount: number): number {
  // Rough estimation based on segwit transaction format
  // Transaction overhead: ~10 vbytes
  // Each input: ~68 vbytes (P2WPKH)
  // Each output: ~31 vbytes
  return 10 + (inputCount * 68) + (outputCount * 31);
}

/**
 * Calculates fee based on estimated transaction size and fee rate
 * 
 * @param vbytes Estimated transaction size in vbytes
 * @param feeRate Fee rate in satoshis per vbyte
 * @returns Estimated fee in satoshis
 */
export function calculateFee(vbytes: number, feeRate: number): number {
  return Math.ceil(vbytes * feeRate);
}

/**
 * Tags UTXOs as resource-containing or regular based on provided data
 * 
 * @param utxos List of UTXOs to tag
 * @param resourceData Optional data about which UTXOs contain resources
 * @returns Tagged ResourceUtxo[] list with hasResource flags set appropriately
 */
export function tagResourceUtxos(
  utxos: ResourceUtxo[],
  resourceData?: {[utxoId: string]: boolean}
): ResourceUtxo[] {
  return utxos.map(utxo => {
    const utxoId = `${utxo.txid}:${utxo.vout}`;
    const hasResource = resourceData ? !!resourceData[utxoId] : utxo.hasResource || false;
    
    return {
      ...utxo,
      hasResource
    };
  });
}

/**
 * Selects UTXOs for a transaction, excluding UTXOs with resources unless explicitly allowed
 * 
 * @param availableUtxos List of available UTXOs to select from
 * @param options Configuration options for the selection process
 * @returns Selection result with chosen UTXOs and fee information
 * @throws Error if insufficient funds or if all available UTXOs contain resources
 */
export function selectUtxos(
  availableUtxos: ResourceUtxo[],
  options: UtxoSelectionOptions
): UtxoSelectionResult {
  const {
    requiredAmount,
    feeRate,
    allowResourceUtxos = false,
    preferOlder = false,
    preferCloserAmount = false,
    avoidUtxoIds = []
  } = options;

  // Filter out UTXOs to avoid and those with resources if not allowed
  let eligibleUtxos = availableUtxos.filter(utxo => {
    const utxoId = `${utxo.txid}:${utxo.vout}`;
    const shouldAvoid = avoidUtxoIds.includes(utxoId);
    const containsResource = utxo.hasResource === true;
    
    // Skip this UTXO if it's in the avoid list
    if (shouldAvoid) return false;
    
    // Skip this UTXO if it contains a resource and we're not allowed to use resource UTXOs
    if (containsResource && !allowResourceUtxos) return false;
    
    return true;
  });

  if (eligibleUtxos.length === 0) {
    // Special error message if we have UTXOs but they all contain resources
    if (availableUtxos.length > 0 && availableUtxos.every(u => u.hasResource)) {
      throw new Error('All available UTXOs contain resources and cannot be used for fees/payments. Please add non-resource UTXOs to your wallet.');
    }
    throw new Error('No eligible UTXOs available for selection');
  }

  // Apply sorting strategy
  if (preferCloserAmount) {
    // Sort by closest to required amount (but still above it)
    eligibleUtxos.sort((a, b) => {
      const aDiff = a.value - requiredAmount;
      const bDiff = b.value - requiredAmount;
      
      // Prioritize UTXOs that cover the amount
      if (aDiff >= 0 && bDiff < 0) return -1;
      if (aDiff < 0 && bDiff >= 0) return 1;
      
      // If both cover or both don't cover, prefer the one closer to required amount
      return Math.abs(aDiff) - Math.abs(bDiff);
    });
  } else if (preferOlder) {
    // Prefer older UTXOs (by txid as a proxy for age - not perfect but simple)
    eligibleUtxos.sort((a, b) => a.txid.localeCompare(b.txid));
  } else {
    // Default: sort by value descending (largest first)
    eligibleUtxos.sort((a, b) => b.value - a.value);
  }

  // Initial fee estimation (1 input, 2 outputs - payment and change)
  let estimatedVbytes = estimateTransactionSize(1, 2);
  let estimatedFee = calculateFee(estimatedVbytes, feeRate);
  
  // Target amount including estimated fee
  let targetAmount = requiredAmount + estimatedFee;
  
  // Select UTXOs
  const selectedUtxos: ResourceUtxo[] = [];
  let totalSelectedValue = 0;
  
  // First pass: try to find a single UTXO that covers the amount
  const singleUtxo = eligibleUtxos.find(utxo => utxo.value >= targetAmount);
  
  if (singleUtxo) {
    selectedUtxos.push(singleUtxo);
    totalSelectedValue = singleUtxo.value;
  } else {
    // Second pass: accumulate UTXOs until we reach the target amount
    for (const utxo of eligibleUtxos) {
      selectedUtxos.push(utxo);
      totalSelectedValue += utxo.value;
      
      // Recalculate fee as we add more inputs
      estimatedVbytes = estimateTransactionSize(selectedUtxos.length, 2);
      estimatedFee = calculateFee(estimatedVbytes, feeRate);
      targetAmount = requiredAmount + estimatedFee;
      
      if (totalSelectedValue >= targetAmount) {
        break;
      }
    }
  }
  
  // Final fee calculation based on actual number of inputs
  estimatedVbytes = estimateTransactionSize(selectedUtxos.length, 2);
  estimatedFee = calculateFee(estimatedVbytes, feeRate);
  
  // Check if we have enough funds
  if (totalSelectedValue < requiredAmount + estimatedFee) {
    throw new Error(`Insufficient funds. Required: ${requiredAmount + estimatedFee}, Available: ${totalSelectedValue}`);
  }
  
  // Calculate change
  let changeAmount = totalSelectedValue - requiredAmount - estimatedFee;
  
  // If change is less than dust limit, add it to the fee
  if (changeAmount > 0 && changeAmount < MIN_DUST_LIMIT) {
    estimatedFee += changeAmount;
    changeAmount = 0;
  }
  
  return {
    selectedUtxos,
    totalSelectedValue,
    estimatedFee,
    changeAmount
  };
}

/**
 * Convenience function to select UTXOs for a payment, explicitly avoiding resource UTXOs
 * 
 * @param availableUtxos List of available UTXOs
 * @param requiredAmount Amount needed for the payment in satoshis
 * @param feeRate Fee rate in satoshis per vbyte
 * @returns Selection result with UTXOs, fee and change information
 */
export function selectUtxosForPayment(
  availableUtxos: ResourceUtxo[],
  requiredAmount: number,
  feeRate: number
): UtxoSelectionResult {
  return selectUtxos(availableUtxos, {
    requiredAmount,
    feeRate,
    allowResourceUtxos: false // Never use resource UTXOs for payments
  });
}

/**
 * Selects UTXOs specifically containing resources (for when you want to use a specific resource)
 * 
 * @param availableUtxos List of available UTXOs
 * @param resourceId Optional specific resource ID to select
 * @returns The matching resource UTXO or null if not found
 */
export function selectResourceUtxo(
  availableUtxos: ResourceUtxo[],
  resourceId?: string
): ResourceUtxo | null {
  // Filter to only include UTXOs with resources
  const resourceUtxos = availableUtxos.filter(utxo => utxo.hasResource);
  
  if (resourceUtxos.length === 0) {
    return null;
  }
  
  // If a specific resource ID is requested, find that UTXO
  if (resourceId) {
    return resourceUtxos.find(utxo => utxo.resourceId === resourceId) || null;
  }
  
  // Otherwise return the first resource UTXO
  return resourceUtxos[0];
} 