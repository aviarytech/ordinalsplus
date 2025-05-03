/**
 * PSBT Utility Functions
 * 
 * This module provides utility functions for handling PSBTs (Partially Signed Bitcoin Transactions)
 * including finalizing PSBTs and extracting raw transactions.
 */

import * as btc from '@scure/btc-signer';
import { base64, hex } from '@scure/base';
import { errorHandler, ErrorCode } from '../utils/error-handler';

/**
 * Ensures a base64 string has proper padding
 * Base64 strings must have a length that's a multiple of 4, padded with '=' characters
 * 
 * @param base64Str Base64 string to check and pad if necessary
 * @returns Properly padded base64 string
 */
function ensureBase64Padding(base64Str: string): string {
  // Remove any whitespace
  base64Str = base64Str.trim();
  
  // Calculate padding needed (if any)
  const padLength = (4 - (base64Str.length % 4)) % 4;
  
  // Add padding if needed
  if (padLength > 0) {
    return base64Str + '='.repeat(padLength);
  }
  
  return base64Str;
}

/**
 * Normalizes PSBT input which could be in base64 or hex format
 * 
 * @param psbtInput PSBT string in base64 or hex format
 * @returns Byte array representing the PSBT
 */
function normalizePsbtInput(psbtInput: string): Uint8Array {
  try {
    // Try to determine if this is base64 or hex
    if (/^[0-9a-fA-F]+$/.test(psbtInput)) {
      // It's a hex string
      console.log("[PSBT Utils] Input appears to be hex format, decoding as hex");
      return hex.decode(psbtInput);
    } else {
      // Assume it's base64 (with or without padding)
      console.log("[PSBT Utils] Input appears to be base64 format, ensuring proper padding");
      const paddedBase64 = ensureBase64Padding(psbtInput);
      return base64.decode(paddedBase64);
    }
  } catch (error) {
    throw new Error(`Failed to decode PSBT input: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Finalizes a PSBT by completing all inputs
 * 
 * @param psbtStr PSBT string (base64 or hex encoded)
 * @returns Finalized transaction object
 */
export function finalizePsbt(psbtStr: string): btc.Transaction {
  try {
    console.log("[PSBT Utils] Attempting to finalize PSBT");
    
    // Normalize and decode the PSBT input
    const psbtBytes = normalizePsbtInput(psbtStr);
    
    // Parse the PSBT
    console.log("[PSBT Utils] Parsing PSBT with Transaction.fromPSBT");
    const tx = btc.Transaction.fromPSBT(psbtBytes);
    
    // Finalize the transaction
    console.log("[PSBT Utils] Finalizing transaction");
    tx.finalize();
    
    return tx;
  } catch (error) {
    console.error("[PSBT Utils] Error finalizing PSBT:", error);
    throw errorHandler.createError(
      ErrorCode.INVALID_TRANSACTION,
      error,
      `Failed to finalize PSBT: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extracts the raw transaction hex from a finalized transaction
 * 
 * @param tx Finalized transaction object
 * @returns Raw transaction hex string
 */
export function extractTransaction(tx: btc.Transaction): string {
  try {
    console.log("[PSBT Utils] Extracting raw transaction");
    // Extract and encode the transaction
    const extracted = tx.extract();
    console.log("[PSBT Utils] Transaction extracted successfully");
    return hex.encode(extracted);
  } catch (error) {
    console.error("[PSBT Utils] Error extracting transaction:", error);
    throw errorHandler.createError(
      ErrorCode.INVALID_TRANSACTION,
      error,
      `Failed to extract raw transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Convenience function to finalize a PSBT and extract the raw transaction in one step
 * 
 * @param psbtStr PSBT string (base64 or hex encoded)
 * @returns Raw transaction hex string
 */
export function finalizeAndExtractTransaction(psbtStr: string): string {
  const finalizedTx = finalizePsbt(psbtStr);
  return extractTransaction(finalizedTx);
} 