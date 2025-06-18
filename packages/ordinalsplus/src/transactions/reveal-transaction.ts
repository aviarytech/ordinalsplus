import * as btc from '@scure/btc-signer';
import { base64, hex } from '@scure/base';
import * as ordinals from 'micro-ordinals';
import * as bitcoin from 'bitcoinjs-lib';
import { Utxo, BitcoinNetwork } from '../types';
import { PreparedInscription } from '../inscription/scripts/ordinal-reveal';
import { calculateFee } from './fee-calculation';
import { transactionTracker, TransactionStatus, TransactionType } from './transaction-status-tracker';
import { ErrorCode, errorHandler, InscriptionError, ErrorCategory, ErrorSeverity } from '../utils/error-handler';
import { withRetry, checkSystemHealth } from '../utils/error-recovery';

// Constant for minimum viable postage value (546 sats)
const MIN_POSTAGE_VALUE = 551;

// Define special output scripts for ordinals
const ORDINAL_CUSTOM_SCRIPTS = [ordinals.OutOrdinalReveal];

/**
 * Parameters required for reveal transaction creation
 */
export interface RevealTransactionParams {
  /** The UTXO to use as the first input for the transaction */
  selectedUTXO: Utxo;
  /** Prepared inscription data with scripts and keys */
  preparedInscription: PreparedInscription;
  /** Fee rate in sats/vB */
  feeRate: number;
  /** Bitcoin network (mainnet/testnet/regtest) */
  network: typeof btc.NETWORK;
  /** Optional private key for signing */
  privateKey?: Uint8Array;
  /** Optional commit transaction ID for linking transactions */
  commitTransactionId?: string;
  /** Optional retry configuration */
  retry?: boolean;
  /** Optional destination address for the inscription output (defaults to commitAddress if not provided) */
  destinationAddress?: string;
}

/**
 * Result of reveal transaction creation
 */
export interface RevealTransactionResult {
  /** The transaction object */
  tx: btc.Transaction;
  /** Fee amount in satoshis */
  fee: number;
  /** Virtual size of the transaction */
  vsize: number;
  /** Transaction hex string */
  hex: string;
  /** Transaction in base64 encoding */
  base64: string;
  /** Transaction ID in the tracker for status monitoring */
  transactionId: string;
}

/**
 * Creates a reveal transaction for an inscription
 * 
 * This function follows the micro-ordinals approach for inscribing data on Bitcoin.
 * It uses the first input as the inscription carrier and creates proper outputs
 * according to the ordinals protocol.
 * 
 * @param params - Parameters for transaction creation
 * @returns Transaction creation result
 */
export async function createRevealTransaction(params: RevealTransactionParams): Promise<RevealTransactionResult> {
  const { selectedUTXO, preparedInscription, feeRate, network, privateKey, commitTransactionId, retry = false, destinationAddress } = params;

  // Create function for execution with potential retry
  const createTransaction = async (): Promise<RevealTransactionResult> => {
    // Check system health before proceeding
    const isHealthy = await checkSystemHealth();
    if (!isHealthy) {
      throw errorHandler.createError(
        ErrorCode.INITIALIZATION_FAILED,
        { function: 'createRevealTransaction' },
        'System health check failed before creating reveal transaction'
      );
    }

    // Validation
    if (!selectedUTXO || selectedUTXO.value <= 0) {
      throw errorHandler.createError(
        ErrorCode.INVALID_UTXO,
        { utxo: selectedUTXO },
        'Selected UTXO has insufficient value'
      );
    }

    if (!preparedInscription.inscriptionScript) {
      throw errorHandler.createError(
        ErrorCode.INVALID_INPUT,
        { preparedInscription },
        'Missing inscription script in prepared inscription'
      );
    }

    if (feeRate <= 0) {
      throw errorHandler.createError(
        ErrorCode.INVALID_FEE_RATE,
        { feeRate },
        'Fee rate must be greater than zero'
      );
    }

    // Create transaction tracker entry at the beginning
    const transactionId = `reveal-${new Date().getTime()}`;
    
    // Add to transaction tracker
    transactionTracker.addTransaction({
      id: transactionId,
      txid: '', // Will be updated once broadcasted
      type: TransactionType.REVEAL,
      status: TransactionStatus.PENDING,
      createdAt: new Date(),
      lastUpdatedAt: new Date(),
      parentId: commitTransactionId, // Link to commit transaction if provided
      metadata: {
        utxo: {
          txid: selectedUTXO.txid,
          vout: selectedUTXO.vout,
          value: selectedUTXO.value
        },
        feeRate,
        network
      }
    });
    
    // Add progress event for reveal transaction start
    transactionTracker.addTransactionProgressEvent({
      transactionId,
      message: 'Starting to create reveal transaction',
      timestamp: new Date()
    });

    try {
      // Calculate input amount
      const inputAmount = BigInt(selectedUTXO.value);

      // Create new transaction for the reveal
      const tx = new btc.Transaction({ 
        allowUnknownOutputs: false, 
        customScripts: ORDINAL_CUSTOM_SCRIPTS 
      });

      // Use the pre-calculated commit address and script details
      if (!preparedInscription.commitAddress || !preparedInscription.commitAddress.script || !preparedInscription.inscription) {
          throw errorHandler.createError(
            ErrorCode.INVALID_INPUT,
            { preparedInscription },
            'Missing commit address, script, or inscription data in prepared inscription for reveal'
          );
      }
      const commitScript = preparedInscription.commitAddress.script;
      const commitAddress = preparedInscription.commitAddress.address;
      const pubKey = preparedInscription.revealPublicKey;
      const inscriptionScript = preparedInscription.inscriptionScript;
      const internalKey = preparedInscription.commitAddress.internalKey;
      
      // Add detailed key logging
      console.log(`[DEBUG-KEYS] Commit Address: ${commitAddress}`);
      console.log(`[DEBUG-KEYS] Commit Script: ${Buffer.from(commitScript).toString('hex')}`);
      console.log(`[DEBUG-KEYS] Reveal Public Key: ${Buffer.from(pubKey).toString('hex')}`);
      console.log(`[DEBUG-KEYS] Internal Key: ${Buffer.from(internalKey).toString('hex')}`);
      console.log(`[DEBUG-KEYS] Inscription Script: ${Buffer.from(inscriptionScript.script).toString('hex')}`);
      console.log(`[DEBUG-KEYS] Control Block: ${Buffer.from(inscriptionScript.controlBlock).toString('hex')}`);
      
      // Check for zero keys
      const isRevealKeyAllZeros = pubKey.every(byte => byte === 0);
      const isInternalKeyAllZeros = internalKey.every(byte => byte === 0);
      const isControlBlockAllZeros = inscriptionScript.controlBlock.every(byte => byte === 0);
      
      if (isRevealKeyAllZeros) {
        console.error('[createRevealTransaction] ERROR: Reveal public key is all zeros!');
      }
      if (isInternalKeyAllZeros) {
        console.error('[createRevealTransaction] ERROR: Internal key is all zeros!');
      }
      if (isControlBlockAllZeros) {
        console.error('[createRevealTransaction] ERROR: Control block is all zeros!');
      }

      // Check the tapInternalKey before using it
      let tapInternalKey = preparedInscription.commitAddress.internalKey;
      
      // Check if the internal key is all zeros
      if (tapInternalKey.every(byte => byte === 0)) {
        console.error('[createRevealTransaction] ERROR: tapInternalKey is all zeros!');
        
        // First, try to extract the key from the commit script
        // P2TR script format: OP_1 OP_PUSHBYTES_32 <32-byte-key>
        if (commitScript.length >= 34 && commitScript[0] === 0x51 && commitScript[1] === 0x20) {
          const extractedKey = commitScript.slice(2, 34);
          if (!extractedKey.every(byte => byte === 0)) {
            console.log('[createRevealTransaction] Using internal key extracted from commit script');
            tapInternalKey = extractedKey;
          } else {
            console.error('[createRevealTransaction] Extracted key is also zeros, falling back to reveal public key');
            tapInternalKey = pubKey;
          }
        } else {
          console.log('[createRevealTransaction] Using reveal public key as fallback for internal key');
          tapInternalKey = pubKey;
        }
        
        // Final validation - should never happen with the steps above
        if (tapInternalKey.every(byte => byte === 0)) {
          throw new Error('Cannot find valid internal key for taproot script-path spend');
        }
      }
      
      // Try to decode the control block - if it fails, we'll log an error
      let decodedControlBlock;
      try {
        decodedControlBlock = btc.TaprootControlBlock.decode(inscriptionScript.controlBlock);
        console.log(`[DEBUG-REVEAL] Successfully decoded control block`);
      } catch (error) {
        console.error(`[DEBUG-REVEAL] Failed to decode control block: ${error instanceof Error ? error.message : String(error)}`);
        // Create a placeholder empty control block
        console.error(`[DEBUG-REVEAL] Will attempt to proceed with a placeholder control block`);
      }
      
      // Add the selected UTXO as the first input using the stored script info
      try {
        tx.addInput({
          txid: selectedUTXO.txid,
          index: selectedUTXO.vout,
          witnessUtxo: {
            script: commitScript,
            amount: inputAmount
          },
          tapInternalKey: tapInternalKey,
          tapLeafScript: [
            [
              decodedControlBlock || btc.TaprootControlBlock.decode(inscriptionScript.controlBlock),
              btc.utils.concatBytes(
                inscriptionScript.script,
                new Uint8Array([inscriptionScript.leafVersion])
              )
            ]
          ]
        });
        console.log(`[DEBUG-REVEAL] Successfully added input with taproot details`);
      } catch (error) {
        console.error(`[DEBUG-REVEAL] Error adding input: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }

      // Destination address for the inscription output
      // Use the provided destination address if available, otherwise fall back to the commit address
      const outputAddress = destinationAddress || commitAddress;
      console.log('reveal transaction input constructed using commit script', tx);
      console.log('reveal transaction output address:', outputAddress, destinationAddress ? '(using provided destination address)' : '(using commit address)');

      // DEBUG-COMMIT-REVEAL logging
      console.log(`[DEBUG-COMMIT-REVEAL] Reveal Address used for output: ${outputAddress}`);
      console.log(`[DEBUG-COMMIT-REVEAL] Commit Script used for witness: ${Buffer.from(commitScript).toString('hex')}`);
      console.log(`[DEBUG-COMMIT-REVEAL] Using Reveal Public Key for signing: ${Buffer.from(pubKey).toString('hex')}`);
      
      // Add progress event for adding input
      transactionTracker.addTransactionProgressEvent({
        transactionId,
        message: `Added input UTXO: ${selectedUTXO.txid}:${selectedUTXO.vout} (${selectedUTXO.value} sats)`,
        timestamp: new Date()
      });

      // Estimate fee based on transaction size
      // CRITICAL FIX: The inscription content is embedded in the witness data
      // We need to calculate the actual transaction size including the full inscription
      const inscriptionSize = preparedInscription.inscription.body?.length || 0;
      
      // DEBUG: Log inscription structure to understand why we're getting 0 size
      console.log('[Inscription Debug] Full inscription structure analysis:');
      console.log('- preparedInscription keys:', Object.keys(preparedInscription));
      console.log('- preparedInscription.inscription keys:', Object.keys(preparedInscription.inscription));
      console.log('- preparedInscription.inscription:', JSON.stringify(preparedInscription.inscription, null, 2));
      console.log('- inscription.body type:', typeof preparedInscription.inscription.body);
      console.log('- inscription.body length:', preparedInscription.inscription.body?.length);
      console.log('- inscription.body constructor:', preparedInscription.inscription.body?.constructor?.name);
      console.log('- inscription.body is Array:', Array.isArray(preparedInscription.inscription.body));
      console.log('- inscription body preview:', preparedInscription.inscription.body ? 
        Array.from(preparedInscription.inscription.body).slice(0, 50) : 'undefined');
      
      // Check if there are any tags that might contain size information
      if (preparedInscription.inscription.tags) {
        console.log('- inscription.tags:', preparedInscription.inscription.tags);
      }
      
      // CRITICAL FIX: Check multiple possible paths for content size
      let actualInscriptionSize = inscriptionSize;
      if (actualInscriptionSize === 0) {
        console.log('[Inscription Debug] Original size was 0, trying alternative paths...');
        
        // Try alternative paths to get content size
        if (typeof preparedInscription.inscription.body === 'string') {
          actualInscriptionSize = Buffer.from(preparedInscription.inscription.body).length;
          console.log('[Inscription Debug] Body is string, calculated size:', actualInscriptionSize);
        } else if (preparedInscription.inscription.body instanceof Buffer) {
          actualInscriptionSize = preparedInscription.inscription.body.length;
          console.log('[Inscription Debug] Body is Buffer, size:', actualInscriptionSize);
        } else if (preparedInscription.inscription.body instanceof Uint8Array) {
          actualInscriptionSize = preparedInscription.inscription.body.length;
          console.log('[Inscription Debug] Body is Uint8Array, size:', actualInscriptionSize);
        } else if (preparedInscription.inscription.body && typeof preparedInscription.inscription.body === 'object') {
          // CRITICAL FIX: Check for serialized Buffer format: { type: "Buffer", data: [...] }
          const body = preparedInscription.inscription.body as any;
          if (body.type === 'Buffer' && Array.isArray(body.data)) {
            actualInscriptionSize = body.data.length;
            console.log('[Inscription Debug] Found serialized Buffer format, size:', actualInscriptionSize);
          } else if (body.byteLength !== undefined) {
            actualInscriptionSize = body.byteLength;
            console.log('[Inscription Debug] Found byteLength property:', actualInscriptionSize);
          } else if (body.length !== undefined) {
            actualInscriptionSize = body.length;
            console.log('[Inscription Debug] Found length property in object:', actualInscriptionSize);
          } else {
            console.log('[Inscription Debug] Body is object but no size property found:', Object.keys(body));
          }
        }
        
        // If still 0, check if we have the content elsewhere
        if (actualInscriptionSize === 0) {
          console.log('[Inscription Debug] Still no size found, checking other locations...');
          
          // Check if the content is in the original preparation parameters
          if (localStorage.getItem('inscriptionData')) {
            try {
              const savedData = JSON.parse(localStorage.getItem('inscriptionData') || '{}');
              if (savedData.inscription && savedData.inscription.body) {
                console.log('[Inscription Debug] Found content in localStorage inscription.body');
                const storedBody = savedData.inscription.body;
                if (typeof storedBody === 'string') {
                  actualInscriptionSize = Buffer.from(storedBody).length;
                  console.log('[Inscription Debug] Size from localStorage (string):', actualInscriptionSize);
                }
              }
            } catch (e) {
              console.log('[Inscription Debug] Could not parse localStorage inscription data');
            }
          }
        }
        
        console.log('[Inscription Debug] Final calculated size:', actualInscriptionSize);
      } else {
        console.log('[Inscription Debug] Original size was already valid:', actualInscriptionSize);
      }
      
      // For reveal transactions, use simplified empirical formula
      // Based on real transaction data where 4059 bytes = ~1130 vB
      let estimatedVsize: number;
      if (actualInscriptionSize > 0) {
        // Empirical formula based on actual Bitcoin transactions:
        // Base overhead: ~100 vB for transaction structure and scripts
        // Content scaling: each byte of content adds ~0.27 vB due to witness discount
        // This gives results much closer to actual on-chain transactions
        estimatedVsize = Math.ceil(100 + (actualInscriptionSize * 0.27));
        
        console.log(`[Vsize Estimation] Content size: ${actualInscriptionSize} bytes`);
        console.log(`[Vsize Estimation] Formula: 100 + (${actualInscriptionSize} * 0.27) = ${estimatedVsize} vB`);
      } else {
        // For non-inscription transactions, use a simpler calculation
        estimatedVsize = 200;
        console.log('[Vsize Estimation] No content found, using fallback size: 200 vB');
      }

      const fee = BigInt(calculateFee(estimatedVsize, feeRate));
      
      // Add progress event for fee calculation
      transactionTracker.addTransactionProgressEvent({
        transactionId,
        message: `Calculated fee: ${fee} sats (${feeRate} sat/vB, estimated size: ${estimatedVsize} vB)`,
        timestamp: new Date()
      });

      // Calculate change amount (making sure we don't create dust outputs)
      const postageValue = BigInt(MIN_POSTAGE_VALUE);
      
      // CRITICAL FIX: The input amount from the commit transaction already includes the reveal fee
      // We should not subtract a separately calculated fee again, as this causes double-counting
      // The commit transaction was funded with: revealFee + postageValue
      // So we should use: inputAmount - postageValue for the actual fee
      const actualFeeAllocated = inputAmount - postageValue;
      const changeAmount = BigInt(0); // No change expected in a properly funded reveal transaction

      // Add the inscription output (recipient)
      // FIXED: Simply add the inscription output with postage value
      // The remaining amount (inputAmount - postageValue) will automatically become the fee
      tx.addOutputAddress(
        outputAddress || '', 
        postageValue,
        network
      );
      
      // Add progress event for adding inscription output
      transactionTracker.addTransactionProgressEvent({
        transactionId,
        message: `Added inscription output: ${outputAddress} (${postageValue} sats), fee allocated: ${actualFeeAllocated} sats`,
        timestamp: new Date()
      });

      // Sign if private key is provided
      if (privateKey) {
        try {
          // Simply sign with the provided private key directly
          console.log('Signing reveal transaction with provided private key for script path spend...');
          
          // Simplify the sign call, relying on default sighash for Taproot
          // and hoping the library correctly uses the tapLeafScript from the stored script info.
          tx.sign(privateKey); 

          tx.finalize(); // Finalize *after* signing
          
          // Add progress event for signing
          transactionTracker.addTransactionProgressEvent({
            transactionId,
            message: 'Transaction signed successfully',
            timestamp: new Date()
          });
        } catch (error: any) {
          // Create a structured error
          const signingError = errorHandler.createError(
            ErrorCode.SIGNING_ERROR,
            error,
            `Failed to sign reveal transaction: ${error?.message || 'Unknown error'}`
          );
          
          // Set error in transaction tracker
          transactionTracker.setTransactionError(transactionId, {
            name: signingError.name,
            message: signingError.message,
            code: signingError.code,
            details: signingError.details,
            category: ErrorCategory.WALLET,
            severity: ErrorSeverity.ERROR,
            timestamp: new Date(),
            recoverable: false
          });
          
          throw signingError;
        }
      }
      
      // We need the finalized raw transaction bytes, not the PSBT bytes
      let txBytes: Uint8Array;
      try {
        // Ensure the transaction is finalized before extracting
        // The finalize call is already within the signing block, 
        // but if no privateKey was provided, it might not have been called.
        // We should ensure finalize() runs if signing occurred.
        // If no signing happens (e.g., returning unsigned tx), 
        // toPSBT() might be correct, but for broadcasting a signed tx, 
        // we need the extracted raw tx.
        
        // If a private key was provided, signing and finalization happened above.
        if (privateKey) {
           txBytes = tx.extract(); // Extract finalized raw transaction bytes
        } else {
           // If no private key, maybe we *do* want the PSBT for external signing?
           // For now, let's assume if we reach here without a key, it's an error
           // or we should return the PSBT. Let's stick to the signed case.
           // Throw an error if trying to extract without signing/finalizing.
           throw new Error("Cannot extract raw transaction; transaction not finalized (likely missing private key).");
        } 
        
      } catch (error: any) {
        // Handle extraction errors
        const extractionError = errorHandler.createError(
          ErrorCode.INVALID_TRANSACTION,
          error,
          `Failed to extract finalized transaction: ${error?.message || 'Unknown error'}`
        );
        
        // Set error in transaction tracker
        transactionTracker.setTransactionError(transactionId, {
          name: extractionError.name,
          message: extractionError.message,
          code: extractionError.code,
          details: extractionError.details,
          category: ErrorCategory.VALIDATION,
          severity: ErrorSeverity.ERROR,
          timestamp: new Date(),
          recoverable: false
        });
        
        throw extractionError;
      }
      
      // Get transaction hex and base64 for clients that need it
      const txHex = hex.encode(txBytes);
      const txBase64 = base64.encode(txBytes);
      
      // Calculate the actual vsize from the finalized transaction
      // Use bitcoinjs-lib to parse the raw transaction and get accurate virtual size
      let actualVsize: number;
      try {
        // Parse the raw transaction bytes
        const parsedTx = bitcoin.Transaction.fromBuffer(Buffer.from(txBytes));
        
        // Get the accurate virtual size directly from bitcoinjs-lib
        actualVsize = parsedTx.virtualSize();
        
        console.log(`[Vsize Debug] Total size: ${txBytes.length}, Virtual size: ${actualVsize} vB`);
        console.log(`[Vsize Debug] Estimated vs Actual: estimated=${estimatedVsize}, actual=${actualVsize}, difference=${estimatedVsize - actualVsize} vB`);
        console.log(`[Vsize Debug] Fee rate check: fee=${Number(fee)}, vsize=${actualVsize}, rate=${(Number(fee) / actualVsize).toFixed(2)} sat/vB`);
        
      } catch (error) {
        console.warn('[Vsize Calculation] Failed to parse transaction with bitcoinjs-lib, using approximation:', error);
        // Fallback: for SegWit transactions, vsize is typically about 75% of total size
        // This is a rough approximation when parsing fails
        actualVsize = Math.ceil(txBytes.length * 0.75);
      }
      
      // Log the comparison between estimated and actual size for debugging
      const actualAllocatedFee = Number(actualFeeAllocated); // Use the actual allocated fee
      const actualEffectiveRate = (actualAllocatedFee / actualVsize).toFixed(2);
      
      console.log(`[Fee Comparison] Estimated vsize: ${estimatedVsize} vB, Actual vsize: ${actualVsize} vB`);
      console.log(`[Fee Comparison] Allocated fee: ${actualAllocatedFee} sats (was estimated: ${Number(fee)} sats)`);
      console.log(`[Fee Comparison] Target fee rate: ${feeRate} sat/vB, Actual effective rate: ${actualEffectiveRate} sat/vB`);
      
      // Check if the actual effective rate is significantly lower than target
      const effectiveRate = actualAllocatedFee / actualVsize;
      if (effectiveRate < feeRate * 0.9) { // If effective rate is more than 10% lower than target
        console.warn(`[Fee Warning] Effective fee rate (${actualEffectiveRate} sat/vB) is significantly lower than target (${feeRate} sat/vB). Transaction may not be prioritized properly.`);
        
        // Calculate what the fee should be based on actual vsize
        const correctFee = Number(calculateFee(actualVsize, feeRate));
        const feeDifference = correctFee - actualAllocatedFee;
        
        console.log(`[Fee Correction] Allocated fee: ${actualAllocatedFee} sats, Correct fee: ${correctFee} sats, Difference: ${feeDifference} sats`);
        
        // If the fee difference is significant (more than 100 sats), we should warn about potential issues
        if (feeDifference > 100) {
          console.error(`[Fee Error] Significant fee underpayment detected! Transaction may not be relayed or confirmed quickly.`);
          console.error(`[Fee Error] Consider using a higher fee rate or improving vsize estimation.`);
          
          // Add this information to the transaction tracker
          transactionTracker.addTransactionProgressEvent({
            transactionId,
            message: `WARNING: Fee underpayment detected. Effective rate: ${actualEffectiveRate} sat/vB (target: ${feeRate} sat/vB)`,
            timestamp: new Date()
          });
        }
      }
      
      // Add progress event for transaction prepared successfully
      transactionTracker.addTransactionProgressEvent({
        transactionId,
        message: `Reveal transaction prepared successfully (actual size: ${actualVsize} bytes, effective rate: ${actualEffectiveRate} sat/vB)`,
        timestamp: new Date()
      });
      
      // Set transaction to ready status
      transactionTracker.setTransactionStatus(transactionId, TransactionStatus.CONFIRMING);
      
      // Return the result with actual vsize and actual allocated fee
      return {
        tx,
        fee: actualAllocatedFee, // Use the fee that was actually allocated in the transaction
        vsize: actualVsize, // Return actual vsize for accurate reporting
        hex: txHex,
        base64: txBase64,
        transactionId,
      };
    } catch (error: unknown) {
      // Convert to structured error if it's not already
      let structuredError: InscriptionError;
      
      if (error instanceof Error && 'code' in error && typeof (error as any).code === 'string') {
        // It might be an InscriptionError already, but let's safely handle it
        structuredError = errorHandler.handleError(error);
      } else {
        // It's definitely not an InscriptionError, so let's convert it
        structuredError = errorHandler.handleError(error);
      }
      
      // Set transaction to failed status if not already set
      transactionTracker.setTransactionStatus(transactionId, TransactionStatus.FAILED);
      
      // Add error event to transaction tracker if not already added
      const txInfo = transactionTracker.getTransaction(transactionId);
      if (txInfo && !txInfo.error) {
        transactionTracker.setTransactionError(transactionId, {
          name: structuredError.name,
          message: structuredError.message,
          code: structuredError.code,
          details: structuredError.details,
          category: ErrorCategory.SYSTEM,
          severity: ErrorSeverity.ERROR,
          timestamp: new Date(),
          recoverable: false
        });
      }
      
      // Re-throw the structured error
      throw structuredError;
    }
  };
  
  // If retry is enabled, use withRetry, otherwise just execute the function once
  if (retry) {
    return withRetry(createTransaction, {
      onRetry: (attempt, delay) => {
        console.log(`Retrying reveal transaction creation (attempt ${attempt}) in ${Math.round(delay / 1000)}s...`);
      }
    });
  } else {
    return createTransaction();
  }
} 