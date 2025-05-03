/**
 * UTXO Selection for Ordinals Transactions
 * 
 * This module implements functions for selecting UTXOs for ordinals transactions.
 * It provides a simple coin selection algorithm optimized for ordinals inscriptions.
 */

import { ResourceUtxo, UtxoSelectionOptions as ResourceUtxoSelectionOptions, UtxoSelectionResult as ResourceUtxoSelectionResult } from '../types/ordinals';
import { Utxo } from '../types';
import { calculateFee } from './fee-calculation';

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
 * Options for simple UTXO selection
 */
export interface SimpleUtxoSelectionOptions {
  /** Target amount to reach (in satoshis) */
  targetAmount: number;
  /** Optional maximum amount of UTXOs to use */
  maxNumUtxos?: number;
  /** Optional preference for UTXO selection strategy */
  strategy?: 'minimize_change' | 'minimize_inputs' | 'optimize_size';
}

/**
 * Result of simple UTXO selection
 */
export interface SimpleUtxoSelectionResult {
  /** Selected UTXOs for the transaction */
  selectedUtxos: Utxo[];
  /** Total value of selected UTXOs */
  totalInputValue: number;
  /** Estimated change amount (if any) */
  changeAmount: number;
}

/**
 * Selects UTXOs to cover a target amount using a simplified approach.
 * This version is used specifically for commit transactions where we 
 * don't need the more complex resource-aware selection.
 * 
 * @param utxos - Available UTXOs
 * @param options - Target amount or detailed options
 * @returns Selected UTXOs and related information
 */
export function selectUtxos(
  utxos: Utxo[],
  options: number | SimpleUtxoSelectionOptions
): SimpleUtxoSelectionResult {
  // Handle simple number input
  const targetAmount = typeof options === 'number' 
    ? options 
    : options.targetAmount;
  
  const maxNumUtxos = typeof options === 'number' 
    ? undefined 
    : options.maxNumUtxos;
  
  const strategy = typeof options === 'number' 
    ? 'minimize_inputs' 
    : options.strategy || 'minimize_inputs';
  
  // Validate inputs
  if (!utxos || utxos.length === 0) {
    throw new Error('No UTXOs provided for selection.');
  }
  
  if (targetAmount <= 0) {
    throw new Error(`Invalid target amount: ${targetAmount}`);
  }
  
  // Sort UTXOs based on selected strategy
  let sortedUtxos = [...utxos];
  
  if (strategy === 'minimize_inputs') {
    // Sort by value descending to use fewest inputs
    sortedUtxos.sort((a, b) => b.value - a.value);
  } else if (strategy === 'minimize_change') {
    // Sort by value ascending to minimize change
    sortedUtxos.sort((a, b) => a.value - b.value);
  } else if (strategy === 'optimize_size') {
    // Sort by value/size ratio (value density) for optimal fee efficiency
    // For now, just sort by value as a reasonable approximation
    sortedUtxos.sort((a, b) => b.value - a.value);
  }
  
  const selected: Utxo[] = [];
  let totalValue = 0;
  
  // Add UTXOs until we reach the target amount
  for (const utxo of sortedUtxos) {
    // Skip invalid UTXOs
    if (!utxo.txid || utxo.vout === undefined || !utxo.value) {
      console.warn(`Skipping invalid UTXO: ${utxo.txid}:${utxo.vout}`);
      continue;
    }
    
    selected.push(utxo);
    totalValue += utxo.value;
    
    // Check if we've reached the target
    if (totalValue >= targetAmount) {
      break;
    }
    
    // Check if we've reached the maximum allowed number of UTXOs
    if (maxNumUtxos && selected.length >= maxNumUtxos) {
      break;
    }
  }
  
  // Check if we have enough funds
  if (totalValue < targetAmount) {
    throw new Error(`Insufficient funds. Required: ${targetAmount}, Available: ${totalValue} from ${utxos.length} UTXOs.`);
  }
  
  // Calculate change amount
  const changeAmount = totalValue - targetAmount;
  
  return {
    selectedUtxos: selected,
    totalInputValue: totalValue,
    changeAmount
  };
}

/**
 * Selects UTXOs for a transaction, excluding UTXOs with resources unless explicitly allowed
 * 
 * @param availableUtxos List of available UTXOs to select from
 * @param options Configuration options for the selection process
 * @returns Selection result with chosen UTXOs and fee information
 * @throws Error if insufficient funds or if all available UTXOs contain resources
 */
export function selectResourceUtxos(
  availableUtxos: ResourceUtxo[],
  options: ResourceUtxoSelectionOptions
): ResourceUtxoSelectionResult {
  const {
    requiredAmount,
    feeRate,
    allowResourceUtxos = false,
    preferOlder = false,
    preferCloserAmount = false,
    avoidUtxoIds = []
  } = options;

  // Convert requiredAmount to bigint for compatibility with fee calculations
  const requiredAmountBigInt = BigInt(requiredAmount);

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
  let targetAmount = requiredAmountBigInt + estimatedFee;
  
  // Select UTXOs
  const selectedUtxos: ResourceUtxo[] = [];
  let totalSelectedValue = 0n;
  
  // First pass: try to find a single UTXO that covers the amount
  const singleUtxo = eligibleUtxos.find(utxo => BigInt(utxo.value) >= targetAmount);
  
  if (singleUtxo) {
    selectedUtxos.push(singleUtxo);
    totalSelectedValue = BigInt(singleUtxo.value);
  } else {
    // Second pass: accumulate UTXOs until we reach the target amount
    for (const utxo of eligibleUtxos) {
      selectedUtxos.push(utxo);
      totalSelectedValue += BigInt(utxo.value);
      
      // Recalculate fee as we add more inputs
      estimatedVbytes = estimateTransactionSize(selectedUtxos.length, 2);
      estimatedFee = calculateFee(estimatedVbytes, feeRate);
      targetAmount = requiredAmountBigInt + estimatedFee;
      
      if (totalSelectedValue >= targetAmount) {
        break;
      }
    }
  }
  
  // Final fee calculation based on actual number of inputs
  estimatedVbytes = estimateTransactionSize(selectedUtxos.length, 2);
  estimatedFee = calculateFee(estimatedVbytes, feeRate);
  
  // Check if we have enough funds
  if (totalSelectedValue < requiredAmountBigInt + estimatedFee) {
    throw new Error(`Insufficient funds. Required: ${requiredAmountBigInt + estimatedFee}, Available: ${totalSelectedValue}`);
  }
  
  // Calculate change
  let changeAmount = totalSelectedValue - requiredAmountBigInt - estimatedFee;
  
  // If change is less than dust limit, add it to the fee
  if (changeAmount > 0n && changeAmount < BigInt(MIN_DUST_LIMIT)) {
    estimatedFee += changeAmount;
    changeAmount = 0n;
  }
  
  return {
    selectedUtxos,
    totalSelectedValue: Number(totalSelectedValue),
    estimatedFee: Number(estimatedFee),
    changeAmount: Number(changeAmount)
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
): ResourceUtxoSelectionResult {
  return selectResourceUtxos(availableUtxos, {
    requiredAmount,
    feeRate,
    allowResourceUtxos: false // Never use resource UTXOs for payments
  });
} 