/**
 * Transaction Signing Utilities for Ordinals Plus
 * 
 * This module provides utilities for signing Bitcoin transactions for
 * ordinals plus inscriptions, particularly focusing on handling the commit
 * and reveal transactions with metadata embedding capabilities.
 */

import * as btc from '@scure/btc-signer';
import { hex, base64 } from '@scure/base';
import { transactionTracker, TransactionStatus, TransactionType } from './transaction-status-tracker';
import { ErrorCategory, ErrorCode, ErrorSeverity, errorHandler, InscriptionError } from '../utils/error-handler';
import { Utxo } from '../types';

// Constants for transaction size estimation
// Following the bitcoin_constants.mdc rule guidelines
export const BASE_TX_OVERHEAD_VBYTES = 10.5;
export const P2TR_OUTPUT_VBYTES = 43;
export const P2WPKH_OUTPUT_VBYTES = 31;
export const P2WPKH_INPUT_VBYTES = 68;
export const P2TR_KEY_PATH_INPUT_VBYTES = 58;
export const P2TR_SCRIPT_PATH_INPUT_VBYTES = 160; // Estimated for reveal tx with inscription
export const DUST_LIMIT_SATS = 546;
export const SAFE_FEE_BUFFER_SATS = 1000;

/**
 * Options for transaction signing
 */
export interface SignTransactionOptions {
  /** Private key to sign with (buffer or hex string) */
  privateKey: Uint8Array | string;
  /** Enable retry mechanism on failure */
  retry?: boolean;
  /** Transaction tracker ID for progress tracking */
  transactionId?: string;
  /** The type of transaction being signed */
  transactionType?: TransactionType;
}

/**
 * Result of a signed transaction
 */
export interface SignedTransactionResult {
  /** The signed transaction object */
  tx: btc.Transaction;
  /** Transaction hex string (for broadcasting) */
  hex: string;
  /** Transaction in base64 encoding */
  base64: string;
  /** Transaction ID in the tracker for status monitoring */
  transactionId: string;
  /** Estimated virtual size of the transaction */
  vsize: number;
}

/**
 * Signs a transaction with the provided private key
 * 
 * @param tx - The transaction to sign
 * @param options - Signing options
 * @returns The signed transaction and related metadata
 */
export async function signTransaction(
  tx: btc.Transaction,
  options: SignTransactionOptions
): Promise<SignedTransactionResult> {
  // Ensure we have a transaction ID for tracking
  const transactionId = options.transactionId || `sign-${new Date().getTime()}`;
  const transactionType = options.transactionType || TransactionType.COMMIT; // Default to COMMIT as fallback
  
  // If not already in the tracker, add it
  const existingTx = transactionTracker.getTransaction(transactionId);
  if (!existingTx) {
    transactionTracker.addTransaction({
      id: transactionId,
      txid: '', // Will be updated when we have the final transaction
      type: transactionType,
      status: TransactionStatus.PENDING,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      metadata: {
        inputCount: tx.inputsLength,
        outputCount: tx.outputsLength,
      }
    });
  }
  
  // Add progress event for signing attempt
  transactionTracker.addTransactionProgressEvent({
    transactionId,
    message: 'Starting transaction signing process',
    timestamp: new Date()
  });
  
  try {
    // Convert private key to Uint8Array if it's a hex string
    let privateKeyBytes: Uint8Array;
    if (typeof options.privateKey === 'string') {
      privateKeyBytes = hex.decode(options.privateKey.startsWith('0x') 
        ? options.privateKey.slice(2) 
        : options.privateKey);
    } else {
      privateKeyBytes = options.privateKey;
    }
    
    // Add progress event for key preparation
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: 'Private key prepared for signing',
      timestamp: new Date()
    });
    
    // Sign the transaction
    tx.sign(privateKeyBytes);
    
    // Finalize the transaction
    tx.finalize();
    
    // Add progress event for successful signing
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: 'Transaction signed successfully',
      timestamp: new Date()
    });
    
    // Extract the finalized transaction
    const txBytes = tx.extract();
    const txHex = hex.encode(txBytes);
    const txBase64 = base64.encode(txBytes);
    
    // Get virtual size
    // Note: @scure/btc-signer doesn't expose virtualSize directly
    // Use the extracted transaction size as an approximation
    const vsize = txBytes.length; // Approximation
    
    // Update transaction tracker status to CONFIRMING
    transactionTracker.setTransactionStatus(transactionId, TransactionStatus.CONFIRMING);
    
    // Add progress event for transaction preparation complete
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: 'Signed transaction prepared successfully',
      timestamp: new Date()
    });
    
    // Return the signed transaction details
    return {
      tx,
      hex: txHex,
      base64: txBase64,
      transactionId,
      vsize,
    };
  } catch (error: unknown) {
    // Convert to structured error if it's not already
    const structuredError = errorHandler.createError(
      ErrorCode.SIGNING_ERROR,
      error,
      `Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    // Set error in transaction tracker
    transactionTracker.setTransactionError(transactionId, structuredError);
    
    // Set transaction to failed status
    transactionTracker.setTransactionStatus(transactionId, TransactionStatus.FAILED);
    
    // Re-throw the structured error
    throw structuredError;
  }
}

/**
 * Signs a transaction with metadata for an ordinals plus inscription
 * 
 * This function extends the basic signTransaction function with specific
 * handling for ordinals plus metadata in reveal transactions.
 * 
 * @param tx - The transaction to sign
 * @param metadata - CBOR-encoded metadata buffer
 * @param options - Signing options
 * @returns The signed transaction with embedded metadata
 */
export async function signWithMetadata(
  tx: btc.Transaction,
  metadata: Uint8Array,
  options: SignTransactionOptions
): Promise<SignedTransactionResult> {
  // Ensure we have a transaction ID for tracking
  const transactionId = options.transactionId || `sign-meta-${new Date().getTime()}`;
  
  // Attach metadata information to the transaction tracker
  const existingTx = transactionTracker.getTransaction(transactionId);
  if (!existingTx) {
    // This is likely a reveal transaction
    transactionTracker.addTransaction({
      id: transactionId,
      txid: '',
      type: TransactionType.REVEAL,
      status: TransactionStatus.PENDING,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      metadata: {
        inputCount: tx.inputsLength,
        outputCount: tx.outputsLength,
        metadataSize: metadata.length,
      }
    });
  } else {
    // Update existing transaction with metadata info
    const updatedMetadata = {
      ...existingTx.metadata,
      metadataSize: metadata.length,
    };
    
    // Create a new transaction object with updated metadata
    const updatedTx = {
      ...existingTx,
      metadata: updatedMetadata,
      lastUpdatedAt: new Date()
    };
    
    // Add the updated transaction to the tracker
    transactionTracker.addTransaction(updatedTx);
  }
  
  try {
    // Log metadata information
    console.log(`[signWithMetadata] Embedding ${metadata.length} bytes of metadata`);
    
    // Add progress event for metadata preparation
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: `Preparing transaction with ${metadata.length} bytes of metadata`,
      timestamp: new Date()
    });
    
    // The metadata is already embedded in the transaction script at this point,
    // so we just need to sign the transaction normally

    // Sign the transaction
    return await signTransaction(tx, {
      ...options,
      transactionId,
      transactionType: TransactionType.REVEAL,
    });
  } catch (error: unknown) {
    // Convert to structured error if it's not already
    const structuredError = errorHandler.createError(
      ErrorCode.SIGNING_ERROR,
      error,
      `Failed to sign transaction with metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    // Set error in transaction tracker if not already set
    const txInfo = transactionTracker.getTransaction(transactionId);
    if (txInfo && !txInfo.error) {
      transactionTracker.setTransactionError(transactionId, structuredError);
    }
    
    // Re-throw the structured error
    throw structuredError;
  }
}

/**
 * Utility function to extract a signed transaction to hex format
 * 
 * @param tx - The transaction to convert to hex
 * @returns The transaction hex string
 */
export function extractSignedTransactionHex(tx: btc.Transaction): string {
  try {
    const txBytes = tx.extract();
    return hex.encode(txBytes);
  } catch (error) {
    throw errorHandler.createError(
      ErrorCode.INVALID_TRANSACTION,
      error,
      'Could not extract transaction hex: Transaction may not be finalized or signed'
    );
  }
}

/**
 * Utility to create a signed transaction for testing or mock purposes
 * 
 * @returns A mock signed transaction result
 */
export function createMockSignedTransaction(): SignedTransactionResult {
  const transactionId = `mock-${new Date().getTime()}`;
  const mockTxHex = 'mockTransactionData';
  
  // Add to transaction tracker
  transactionTracker.addTransaction({
    id: transactionId,
    txid: 'mock-txid-' + Date.now(),
    type: TransactionType.COMMIT, // Use COMMIT as a default type
    status: TransactionStatus.CONFIRMING,
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    metadata: {
      mock: true
    }
  });
  
  return {
    tx: new btc.Transaction(),
    hex: mockTxHex,
    base64: base64.encode(new TextEncoder().encode(mockTxHex)),
    transactionId,
    vsize: 200, // Arbitrary size for mock
  };
} 