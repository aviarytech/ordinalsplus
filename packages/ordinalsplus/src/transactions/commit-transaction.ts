/**
 * Commit Transaction Processing for Ordinals
 * 
 * This module implements the commit transaction process for ordinals inscriptions
 * based on the micro-ordinals approach. It handles the generation of the 
 * commit address and preparation of the commit transaction.
 */

import * as btc from '@scure/btc-signer';
import { PreparedInscription } from '../inscription/scripts/ordinal-reveal';
import { Utxo, BitcoinNetwork } from '../types';
import { calculateFee } from './fee-calculation';
import { selectUtxos, SimpleUtxoSelectionOptions } from './utxo-selection';
import { getScureNetwork } from '../utils/networks';
import { transactionTracker, TransactionStatus, TransactionType } from './transaction-status-tracker';
import * as ordinals from 'micro-ordinals';
import { createInscription } from '../inscription';

// Define minimum dust limit (satoshis)
const MIN_DUST_LIMIT = 546;

/**
 * Parameters for preparing a commit transaction
 */
export interface CommitTransactionParams {
  /** The prepared inscription containing the commit address */
  inscription: PreparedInscription;
  /** Available UTXOs to fund the transaction */
  utxos: Utxo[];
  /** Address to send change back to */
  changeAddress: string;
  /** Fee rate in sats/vB */
  feeRate: number;
  /** Bitcoin network configuration */
  network: BitcoinNetwork;
  /** Optional minimum amount for the commit output */
  minimumCommitAmount?: number;
}

/**
 * Result of the commit transaction preparation
 */
export interface CommitTransactionResult {
  /** P2TR address for the commit output */
  commitAddress: string;
  /** Base64-encoded PSBT for the commit transaction */
  commitPsbtBase64: string;
  /** Raw PSBT object for commit transaction (for direct manipulation) */
  commitPsbt: btc.Transaction;
  /** The exact amount required for the commit output */
  requiredCommitAmount: number;
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
 * Estimates the size of a commit transaction
 * 
 * @param inputCount - Number of transaction inputs
 * @param outputCount - Number of transaction outputs (including commit and change)
 * @returns Estimated transaction size in virtual bytes
 */
function estimateCommitTxSize(inputCount: number, outputCount: number): number {
  // Transaction overhead
  const overhead = 10.5;
  
  // P2WPKH inputs (assuming most common case)
  const inputSize = 68 * inputCount;
  
  // P2TR output for commit and P2WPKH for change
  const commitOutputSize = 43; // P2TR output
  const changeOutputSize = outputCount > 1 ? 31 * (outputCount - 1) : 0; // P2WPKH outputs for change
  
  return Math.ceil(overhead + inputSize + commitOutputSize + changeOutputSize);
}

/**
 * Prepares a commit transaction for an ordinals inscription
 * 
 * @param params - Parameters for the commit transaction
 * @returns Complete information for the prepared commit transaction
 */
export async function prepareCommitTransaction(
  params: CommitTransactionParams
): Promise<CommitTransactionResult> {
  const { 
    inscription, 
    utxos, 
    changeAddress, 
    feeRate,
    network,
    minimumCommitAmount = MIN_DUST_LIMIT
  } = params;
  
  // Validate inputs
  if (!utxos || utxos.length === 0) {
    throw new Error('No UTXOs provided to fund the transaction.');
  }
  
  if (!inscription || !inscription.commitAddress) {
    throw new Error('Invalid inscription: missing commit address information.');
  }
  
  if (!changeAddress) {
    throw new Error('Change address is required.');
  }
  
  if (feeRate <= 0) {
    throw new Error(`Invalid fee rate: ${feeRate}`);
  }
  
  // Get the commit address from the prepared inscription
  const commitAddress = inscription.commitAddress.address;
  
  // Calculate minimum amount needed for the commit output
  // This ensures the UTXO created is spendable, meeting dust limit and 
  // possibly accounting for the reveal transaction's fee
  const commitOutputValue = Math.max(minimumCommitAmount, MIN_DUST_LIMIT);
  
  // Estimate commit transaction size for initial fee calculation
  // Start with a reasonable guess of 1 input, 2 outputs (commit + change)
  const estimatedCommitVBytes = estimateCommitTxSize(1, 2);
  
  // Calculate estimated fee
  const estimatedCommitFee = Number(calculateFee(estimatedCommitVBytes, feeRate));
  
  // Select UTXOs to cover the amount needed (commit output + estimated fee)
  const options: SimpleUtxoSelectionOptions = {
    targetAmount: commitOutputValue + estimatedCommitFee
  };
  
  const selectionResult = selectUtxos(utxos, options);
  const { selectedUtxos, totalInputValue } = selectionResult;
  
  if (!selectedUtxos || selectedUtxos.length === 0) {
    throw new Error('Insufficient funds to cover commit value and estimated fee.');
  }
  
  // Create transaction tracker entry at the beginning
  const transactionId = `commit-${new Date().getTime()}`;
  
  // Add to transaction tracker
  transactionTracker.addTransaction({
    id: transactionId,
    txid: '', // Will be updated once broadcasted
    type: TransactionType.COMMIT,
    status: TransactionStatus.PENDING,
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    metadata: {
      commitAddress,
      feeRate,
      network,
      selectedUtxos: selectedUtxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value
      }))
    }
  });
  
  // Add progress event for UTXO selection
  transactionTracker.addTransactionProgressEvent({
    transactionId,
    message: `Selected ${selectedUtxos.length} UTXOs with total value ${totalInputValue} sats`,
    timestamp: new Date()
  });
  
  // Get the network configuration
  const scureNetwork = getScureNetwork(network);
  
  // Create transaction
  const tx = new btc.Transaction();
  
  // Add inputs
  for (const utxo of selectedUtxos) {
    if (!utxo.scriptPubKey) {
      console.warn(`Skipping UTXO ${utxo.txid}:${utxo.vout} due to missing scriptPubKey.`);
      continue;
    }
    
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: Buffer.from(utxo.scriptPubKey, 'hex'),
        amount: BigInt(utxo.value)
      }
    });
  }
  
  // More accurate fee calculation now that we know exact input count
  const actualCommitVBytes = estimateCommitTxSize(tx.inputsLength, 2); // Assuming 2 outputs (commit + change)
  const recalculatedCommitFee = Number(calculateFee(actualCommitVBytes, feeRate));
  
  // Add progress event for fee calculation
  transactionTracker.addTransactionProgressEvent({
    transactionId,
    message: `Calculated fee: ${recalculatedCommitFee} sats (${feeRate} sat/vB)`,
    timestamp: new Date()
  });
  
  // Always add the commit output using the provided address
  // Remove the complex conditional logic and P2TR derivation from this function
  tx.addOutputAddress(
    commitAddress, // Use the address directly from the inscription object
    BigInt(commitOutputValue),
    scureNetwork
  );
  
  // Add progress event for adding the commit output
  transactionTracker.addTransactionProgressEvent({
    transactionId,
    message: `Added commit output to address ${commitAddress} for ${commitOutputValue} sats`,
    timestamp: new Date()
  });
  
  // Calculate change amount
  const changeAmount = totalInputValue - commitOutputValue - recalculatedCommitFee;
  
  // Add change output if above dust limit
  if (changeAmount >= MIN_DUST_LIMIT) {
    // Add change output directly using the address
    tx.addOutputAddress(
      changeAddress,
      BigInt(changeAmount),
      scureNetwork
    );
  } else {
    // If change is below dust limit, add it to the fee
    // This is effectively a fee increase, but necessary to avoid dust outputs
    console.log(`Change amount ${changeAmount} is below dust limit, adding to fee.`);
    
    // Add progress event for dust change
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: `Change amount ${changeAmount} is below dust limit, adding to fee`,
      timestamp: new Date()
    });
  }
  
  // Final fee calculation (includes any dust amount added to fee)
  const finalFee = totalInputValue - commitOutputValue - 
    (changeAmount >= MIN_DUST_LIMIT ? changeAmount : 0);
  
  // Get the PSBT as base64
  const txPsbt = tx.toPSBT();
  const commitPsbtBase64 = typeof txPsbt === 'string' ? txPsbt : Buffer.from(txPsbt).toString('base64');
  
  // Update transaction status to ready for broadcast
  transactionTracker.setTransactionStatus(transactionId, TransactionStatus.CONFIRMING);
  
  // Add progress event for transaction completion
  transactionTracker.addTransactionProgressEvent({
    transactionId,
    message: 'Commit transaction prepared and ready for broadcast',
    timestamp: new Date(),
    data: {
      commitPsbtBase64: commitPsbtBase64.slice(0, 20) + '...' // Truncated for logging
    }
  });
  
  return {
    commitAddress,
    commitPsbtBase64,
    commitPsbt: tx,
    requiredCommitAmount: commitOutputValue,
    selectedUtxos,
    fees: {
      commit: finalFee
    },
    transactionId
  };
} 