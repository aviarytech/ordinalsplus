/**
 * DEPRECATED - This file contains legacy code and is being replaced by the commit-transaction.ts implementation.
 * 
 * Please use the new commit transaction and inscription modules instead:
 * - transactions/commit-transaction.ts: For commit transaction preparation
 * - inscription/index.ts: For inscription creation and handling
 */

import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import { Utxo } from '../types'; // Assuming Utxo type is defined here or imported

// Initialize ECC
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

const MIN_DUST_LIMIT = 546; // Define dust limit

// --- Add simple fee calculation helper --- 
// DEPRECATED: Use fee-calculation.ts instead
const calculateFeeSimple = (vbytes: number, feeRate: number): number => {
    return Math.ceil(vbytes * feeRate);
};

// Helper: Select UTXOs (copied and adapted from frontend, assumes simple strategy)
// DEPRECATED: Use utxo-selection.ts instead
const selectUtxosForAmount = (utxos: Utxo[], amount: number, fee: number): Utxo[] | null => {
    let selected: Utxo[] = [];
    let totalValue = 0;
    const targetAmount = amount + fee;

    const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value);

    for (const utxo of sortedUtxos) {
        selected.push(utxo);
        totalValue += utxo.value;
        if (totalValue >= targetAmount) {
            break;
        }
    }

    if (totalValue < targetAmount) {
        console.error(`Insufficient funds. Required: ${targetAmount}, Available: ${totalValue} from ${utxos.length} UTXOs.`);
        return null; // Indicate failure
    }
    return selected;
};

// Helper: Get Taproot Output Script (copied from frontend)
// DEPRECATED: Use the P2TR address utilities in inscription/p2tr/key-utils.ts instead
const getTaprootOutputScript = (publicKeyHex: string, network: bitcoin.Network): Buffer => {
    const internalPubKey = Buffer.from(publicKeyHex, 'hex').slice(1); // x-only
    const { output } = bitcoin.payments.p2tr({ internalPubkey: internalPubKey, network });
    if (!output) throw new Error("Failed to generate P2TR output script");
    return output;
};


/**
 * DEPRECATED - Use prepareCommitTransaction from commit-transaction.ts instead
 * 
 * Prepares the unsigned commit transaction PSBT.
 *
 * @param utxos Available UTXOs to fund the transaction.
 * @param commitOutputValue The exact value required for the commit output (P2TR address).
 * @param recipientPublicKey The recipient's public key (hex string, used to derive P2TR commit address).
 * @param changeAddress The address to send any change back to.
 * @param network The bitcoin network configuration.
 * @param feeRate The desired fee rate in sats/vB.
 * @returns A promise resolving to the unsigned PSBT object and context.
 * @throws If insufficient funds or other construction errors.
 */
export async function prepareCommitTransactionPsbt(
    utxos: Utxo[],
    commitOutputValue: number,
    recipientPublicKey: string,
    changeAddress: string,
    network: bitcoin.Network,
    feeRate: number
): Promise<{ psbt: bitcoin.Psbt; selectedUtxos: Utxo[]; commitFee: number }> {
    console.log(`[prepareCommitTransactionPsbt] Starting. Need commit value: ${commitOutputValue}, feeRate: ${feeRate}`);

    if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs provided to fund the transaction.');
    }
    if (typeof recipientPublicKey !== 'string' || recipientPublicKey.length !== 66) {
        throw new Error(`Invalid recipient public key: ${recipientPublicKey}`);
    }
    if (commitOutputValue <= 0) {
         throw new Error(`Invalid commit output value: ${commitOutputValue}`);
    }
    if (feeRate <= 0) {
        throw new Error(`Invalid fee rate: ${feeRate}`);
    }

    // Rough estimate for UTXO selection
    const estimatedCommitVBytes = 155; // TODO: Refine fee estimation based on actual inputs/outputs
    // --- Use local simple fee calculation --- 
    const estimatedCommitFee = calculateFeeSimple(estimatedCommitVBytes, feeRate);
    console.log(`[prepareCommitTransactionPsbt] Estimated commit fee: ${estimatedCommitFee} sats`);

    // Select UTXOs
    const requiredAmount = commitOutputValue + estimatedCommitFee;
    const selectedUtxos = selectUtxosForAmount(utxos, commitOutputValue, estimatedCommitFee);
    if (!selectedUtxos) {
        throw new Error('Insufficient funds. Could not select UTXOs to cover commit value and estimated fee.');
    }
    const totalInputValue = selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0);
    console.log(`[prepareCommitTransactionPsbt] Selected ${selectedUtxos.length} UTXOs with total value: ${totalInputValue} sats`);

    // Create PSBT
    const psbt = new bitcoin.Psbt({ network });
    let inputsTotalValue = 0;

    // Add Inputs (Assuming P2WPKH/P2TR inputs)
    for (const utxo of selectedUtxos) {
        if (!utxo.scriptPubKey) {
            console.warn(`[prepareCommitTransactionPsbt] Skipping UTXO ${utxo.txid}:${utxo.vout} due to missing scriptPubKey.`);
            continue;
        }
        psbt.addInput({
            hash: utxo.txid,
            index: utxo.vout,
            witnessUtxo: {
                script: Buffer.from(utxo.scriptPubKey, 'hex'),
                value: utxo.value,
            },
            // Add nonWitnessUtxo if dealing with legacy inputs
        });
        inputsTotalValue += utxo.value;
    }

    // Add Commit Output (P2TR)
    // WARNING: This uses the *recipient's* public key to derive the commit script.
    // This implies the recipient must provide the reveal signature, or the backend
    // derived the key pair sent back in revealSignerWif from this publicKey.
    // Ensure this matches the logic in the backend's constructGenericPsbt.
    const commitOutputScript = getTaprootOutputScript(recipientPublicKey, network);
    psbt.addOutput({
        script: commitOutputScript,
        value: commitOutputValue,
    });

    // Add Change Output (P2WPKH)
    // More accurate fee calculation based on actual inputs/outputs
    // TODO: Improve accuracy (needs witness sizes etc.)
    const actualCommitFee = inputsTotalValue - commitOutputValue; // Simplistic
    const changeValue = inputsTotalValue - commitOutputValue - actualCommitFee;

    if (changeValue < 0) {
        throw new Error(`Internal Error: Negative change value calculated (${changeValue}).`);
    }
    if (changeValue >= MIN_DUST_LIMIT) {
        psbt.addOutput({
            address: changeAddress,
            value: changeValue,
        });
    }
    
    // TODO: Re-calculate commitFee more accurately here based on final structure?
    const finalCommitFee = actualCommitFee + (changeValue < MIN_DUST_LIMIT ? changeValue : 0);

    console.log(`[prepareCommitTransactionPsbt] Prepared unsigned commit PSBT. Fee: ~${finalCommitFee} sats`);
    return { psbt, selectedUtxos, commitFee: finalCommitFee };
}

/**
 * Loads the reveal PSBT, signs its input using the provided WIF key, and finalizes it.
 * 
 * @param revealPsbtBase64 The base64 encoded reveal PSBT received from the backend.
 * @param revealSignerWif The WIF private key corresponding to the taproot script public key.
 * @param network The bitcoin network configuration.
 * @returns A promise resolving to the signed and finalized reveal PSBT object.
 * @throws If PSBT loading, WIF decoding, or signing fails.
 */
export async function prepareAndSignRevealPsbt(
    revealPsbtBase64: string, 
    revealSignerWif: string, 
    network: bitcoin.Network
): Promise<bitcoin.Psbt> {
    console.log("[prepareAndSignRevealPsbt] Loading and signing reveal PSBT...");

    if (!revealPsbtBase64 || !revealSignerWif) {
        throw new Error("Reveal PSBT (base64) and Signer WIF are required.");
    }

    try {
        // 1. Load PSBT
        const revealPsbt = bitcoin.Psbt.fromBase64(revealPsbtBase64, { network });
        console.log("[prepareAndSignRevealPsbt] Loaded PSBT.");

        if (revealPsbt.txInputs.length === 0) {
             throw new Error("Loaded reveal PSBT has no inputs.");
        }
        const inputIndex = 0; // Assume inscription input is always first

        // 2. Get key pair from WIF
        const signerKeyPair = ECPair.fromWIF(revealSignerWif, network);
        // FIX: Convert public key to Buffer for logging and signer object
        const signerPublicKeyBuffer = Buffer.from(signerKeyPair.publicKey);
        console.log(`[prepareAndSignRevealPsbt] Derived signer public key: ${signerPublicKeyBuffer.toString('hex')}`);

        // 3. Create Signer object for psbt.signInput
        if (typeof signerKeyPair.signSchnorr !== 'function') {
            throw new Error("signSchnorr method not found on signerKeyPair. Check ecpair version/types.");
        }
        const schnorrSigner: bitcoin.Signer = {
            // FIX: Use the converted Buffer public key
            publicKey: signerPublicKeyBuffer,
            // FIX: Wrap signSchnorr to handle Buffer/Uint8Array conversion
            signSchnorr: (hash: Buffer): Buffer => {
                // Convert hash Buffer to Uint8Array for ecpair's signSchnorr
                const hashUint8Array = Uint8Array.from(hash);
                // Call original signSchnorr
                const signatureUint8Array = signerKeyPair.signSchnorr(hashUint8Array);
                // Convert resulting signature Uint8Array back to Buffer for bitcoinjs-lib
                return Buffer.from(signatureUint8Array);
            },
            // --- Add dummy sign method to satisfy Signer interface --- 
            sign: (hash: Buffer): Buffer => {
                console.warn("[prepareAndSignRevealPsbt] ECDSA sign method called unexpectedly on Schnorr signer!");
                // Throw error or return an obviously invalid signature
                throw new Error("ECDSA sign method called unexpectedly during Taproot script path signing.");
                // return Buffer.alloc(64); // Alternative: Return dummy buffer
            },
        };

        // 4. Sign the input
        console.log(`[prepareAndSignRevealPsbt] Signing input ${inputIndex}...`);
        revealPsbt.signInput(inputIndex, schnorrSigner, [bitcoin.Transaction.SIGHASH_DEFAULT]);
        console.log(`[prepareAndSignRevealPsbt] Input ${inputIndex} signed.`);

        // 5. Finalize the input
        // It's generally recommended to finalize after signing
        console.log(`[prepareAndSignRevealPsbt] Finalizing input ${inputIndex}...`);
        revealPsbt.finalizeInput(inputIndex);
        // Alternatively, finalize all inputs if certain:
        // revealPsbt.finalizeAllInputs(); 
        console.log(`[prepareAndSignRevealPsbt] Input ${inputIndex} finalized.`);

        return revealPsbt;

    } catch (error) {
        console.error("[prepareAndSignRevealPsbt] Error:", error);
        throw new Error(`Failed to prepare/sign reveal PSBT: ${error instanceof Error ? error.message : String(error)}`);
    }
} 