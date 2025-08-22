/**
 * Batch Commit Transaction Processing for Ordinals
 * 
 * This module implements batch commit transaction processing for multiple ordinals inscriptions
 * in a single transaction. It handles the generation of commit addresses for multiple inscriptions
 * and preparation of the batch commit transaction with proper postage allocation.
 */

import * as btc from '@scure/btc-signer';
import { PreparedInscription } from '../inscription/scripts/ordinal-reveal';
import { Utxo, BitcoinNetwork } from '../types';
import { calculateFee } from './fee-calculation';
import { selectUtxos, SimpleUtxoSelectionOptions } from './utxo-selection';
import { getScureNetwork } from '../utils/networks';
import { transactionTracker, TransactionStatus, TransactionType } from './transaction-status-tracker';
import { createInscription, CreateInscriptionParams } from '../inscription';

// Define minimum dust limit (satoshis)
const MIN_DUST_LIMIT = 546;

/**
 * Parameters for a single inscription in a batch
 */
export interface BatchInscriptionParams {
  /** The content to inscribe (string or binary data) */
  content: Uint8Array | string;
  /** The MIME type of the content (if known) */
  contentType?: string;
  /** The filename to use for guessing the MIME type (if contentType is not provided) */
  filename?: string;
  /** Additional metadata for the inscription */
  metadata?: Record<string, string>;
  /** The amount of satoshis to allocate for this inscription output (postage) */
  postage: number;
}

/**
 * Parameters for preparing a batch commit transaction
 */
export interface BatchCommitTransactionParams {
  /** Array of inscription parameters to create in the batch */
  inscriptions: BatchInscriptionParams[];
  /** Available UTXOs to fund the transaction */
  utxos: Utxo[];
  /** Address to send change back to */
  changeAddress: string;
  /** Fee rate in sats/vB */
  feeRate: number;
  /** Bitcoin network configuration */
  network: BitcoinNetwork;
  /** Optional recovery public key to use for all commit addresses */
  recoveryPublicKey?: Uint8Array;
}

/**
 * Information about a single inscription in the batch result
 */
export interface BatchInscriptionResult {
  /** Index of this inscription in the batch (0-based) */
  index: number;
  /** The prepared inscription containing the commit address */
  inscription: PreparedInscription;
  /** P2TR address for the commit output */
  commitAddress: string;
  /** The postage amount allocated for this inscription */
  postage: number;
  /** The expected sat number range for this inscription based on postage */
  expectedSatRange: {
    /** First sat number in the range */
    start: number;
    /** Last sat number in the range */
    end: number;
  };
}

/**
 * Result of the batch commit transaction preparation
 */
export interface BatchCommitTransactionResult {
  /** Array of inscription results with their commit addresses and sat ranges */
  inscriptions: BatchInscriptionResult[];
  /** Base64-encoded PSBT for the batch commit transaction */
  commitPsbtBase64: string;
  /** Raw PSBT object for commit transaction (for direct manipulation) */
  commitPsbt: btc.Transaction;
  /** Total amount required for all commit outputs */
  totalCommitAmount: number;
  /** Selected UTXOs for the transaction */
  selectedUtxos: Utxo[];
  /** Fee information */
  fees: {
    /** Estimated fee for the commit transaction in satoshis */
    commit: number;
  };
  /** Transaction ID in the tracker for status monitoring */
  transactionId?: string;
}

/**
 * Estimates the size of a batch commit transaction
 * 
 * @param inputCount - Number of transaction inputs
 * @param outputCount - Number of transaction outputs (including all commits and change)
 * @returns Estimated transaction size in virtual bytes
 */
function estimateBatchCommitTxSize(inputCount: number, outputCount: number): number {
  // Transaction overhead
  const overhead = 10.5;
  
  // P2WPKH inputs (assuming most common case)
  const inputSize = 68 * inputCount;
  
  // P2TR outputs for commits and P2WPKH for change
  const commitOutputsSize = 43 * (outputCount - 1); // P2TR outputs for each inscription
  const changeOutputSize = 31; // P2WPKH output for change
  
  return Math.ceil(overhead + inputSize + commitOutputsSize + changeOutputSize);
}

/**
 * Calculates the expected sat number ranges for each inscription based on postage
 * 
 * @param selectedUtxos - The UTXOs selected for the transaction
 * @param inscriptions - Array of inscription parameters with postage
 * @returns Array of sat ranges for each inscription
 */
function calculateSatRanges(
  selectedUtxos: Utxo[], 
  inscriptions: BatchInscriptionParams[]
): Array<{ start: number; end: number }> {
  // Calculate the starting sat number based on the first UTXO
  // This is a simplified approach - in reality, sat numbering is more complex
  const firstUtxo = selectedUtxos[0];
  let currentSat = 0; // This would need to be calculated based on the actual UTXO's sat position
  
  const ranges: Array<{ start: number; end: number }> = [];
  
  for (const inscription of inscriptions) {
    const start = currentSat;
    const end = currentSat + inscription.postage - 1;
    ranges.push({ start, end });
    currentSat += inscription.postage;
  }
  
  return ranges;
}

/**
 * Prepares a batch commit transaction for multiple ordinals inscriptions
 * 
 * @param params - Parameters for the batch commit transaction
 * @returns Complete information for the prepared batch commit transaction
 */
export async function prepareBatchCommitTransaction(
  params: BatchCommitTransactionParams
): Promise<BatchCommitTransactionResult> {
  const { 
    inscriptions, 
    utxos, 
    changeAddress, 
    feeRate,
    network,
    recoveryPublicKey
  } = params;
  
  // Validate inputs
  if (!inscriptions || inscriptions.length === 0) {
    throw new Error('No inscriptions provided for batch commit transaction.');
  }
  
  if (!utxos || utxos.length === 0) {
    throw new Error('No UTXOs provided to fund the transaction.');
  }
  
  if (!changeAddress) {
    throw new Error('Change address is required.');
  }
  
  if (feeRate <= 0) {
    throw new Error(`Invalid fee rate: ${feeRate}`);
  }
  
  // Validate postage amounts
  for (let i = 0; i < inscriptions.length; i++) {
    const inscription = inscriptions[i];
    if (inscription.postage < MIN_DUST_LIMIT) {
      throw new Error(`Inscription ${i} postage (${inscription.postage}) is below dust limit (${MIN_DUST_LIMIT})`);
    }
  }
  
  // Prepare all inscriptions
  const preparedInscriptions: PreparedInscription[] = [];
  for (const inscriptionParams of inscriptions) {
    const prepared = createInscription({
      content: inscriptionParams.content,
      contentType: inscriptionParams.contentType,
      filename: inscriptionParams.filename,
      metadata: inscriptionParams.metadata,
      network,
      recoveryPublicKey
    });
    preparedInscriptions.push(prepared);
  }
  
  // Calculate total commit amount needed
  const totalCommitAmount = inscriptions.reduce((sum, inscription) => sum + inscription.postage, 0);
  
  // Estimate transaction size
  const outputCount = inscriptions.length + 1; // One output per inscription + change
  const estimatedVBytes = estimateBatchCommitTxSize(1, outputCount); // Start with 1 input estimate
  
  // Calculate estimated fee
  const estimatedFee = Number(calculateFee(estimatedVBytes, feeRate));
  
  // Calculate total amount needed
  const totalNeeded = totalCommitAmount + estimatedFee;
  
  // Select UTXOs
  const utxoSelectionOptions: SimpleUtxoSelectionOptions = {
    targetAmount: totalNeeded
  };
  
  const utxoSelectionResult = selectUtxos(utxos, utxoSelectionOptions);
  const selectedUtxos = utxoSelectionResult.selectedUtxos;
  
  if (!selectedUtxos || selectedUtxos.length === 0) {
    throw new Error(`Insufficient funds: need ${totalNeeded} sats but no UTXOs selected`);
  }
  
  const totalInputValue = utxoSelectionResult.totalInputValue;
  
  if (totalInputValue < totalNeeded) {
    throw new Error(`Insufficient funds: need ${totalNeeded} sats but only have ${totalInputValue} sats`);
  }
  
  // Recalculate fee with actual input count
  const actualVBytes = estimateBatchCommitTxSize(selectedUtxos.length, outputCount);
  const actualFee = Number(calculateFee(actualVBytes, feeRate));
  const actualTotalNeeded = totalCommitAmount + actualFee;
  
  if (totalInputValue < actualTotalNeeded) {
    throw new Error(`Insufficient funds after fee recalculation: need ${actualTotalNeeded} sats but only have ${totalInputValue} sats`);
  }
  
  // Calculate change amount
  const changeAmount = totalInputValue - actualTotalNeeded;
  
  // Calculate sat ranges for each inscription
  const satRanges = calculateSatRanges(selectedUtxos, inscriptions);
  
  // Create the transaction
  const scureNetwork = getScureNetwork(network);
  const tx = new btc.Transaction({ allowUnknownOutputs: true, allowLegacyWitnessUtxo: true });
  
  // Add inputs
  for (const utxo of selectedUtxos) {
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(utxo.scriptPubKey || '', 'hex'),
        amount: BigInt(utxo.value)
      }
    });
  }
  
  // Add outputs for each inscription
  const inscriptionResults: BatchInscriptionResult[] = [];
  for (let i = 0; i < preparedInscriptions.length; i++) {
    const prepared = preparedInscriptions[i];
    const postage = inscriptions[i].postage;
    const satRange = satRanges[i];
    
    // Add commit output
    tx.addOutputAddress(prepared.commitAddress.address, BigInt(postage), scureNetwork);
    
    inscriptionResults.push({
      index: i,
      inscription: prepared,
      commitAddress: prepared.commitAddress.address,
      postage,
      expectedSatRange: satRange
    });
  }
  
  // Add change output if needed
  if (changeAmount > MIN_DUST_LIMIT) {
    tx.addOutputAddress(changeAddress, BigInt(changeAmount), scureNetwork);
  }
  
  // Create PSBT
  const psbt = tx.toPSBT();
  const commitPsbtBase64 = Buffer.from(psbt).toString('base64');
  
  // Track the transaction
  let transactionId: string | undefined;
  try {
    // Generate a unique transaction ID
    transactionId = `batch_commit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    transactionTracker.addTransaction({
      id: transactionId,
      txid: '', // Will be filled when transaction is broadcast
      type: TransactionType.BATCH_COMMIT,
      status: TransactionStatus.PREPARED,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      metadata: {
        inscriptionCount: inscriptions.length,
        totalCommitAmount,
        fee: actualFee,
        network,
        psbtBase64: commitPsbtBase64 // Store PSBT in metadata instead
      }
    });
    console.log(`[BATCH_COMMIT] Transaction tracked with ID: ${transactionId}`);
  } catch (error) {
    console.warn(`[BATCH_COMMIT] Failed to track transaction:`, error);
  }
  
  return {
    inscriptions: inscriptionResults,
    commitPsbtBase64,
    commitPsbt: tx,
    totalCommitAmount,
    selectedUtxos,
    fees: {
      commit: actualFee
    },
    transactionId
  };
}