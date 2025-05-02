import { hex, base64, utf8 } from '@scure/base';
import { bytesToHex, hexToBytes, concatBytes } from '@noble/hashes/utils';
import * as btc from '@scure/btc-signer';
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import * as ordinals from 'micro-ordinals';
import { NETWORKS, getScureNetwork } from '../utils/networks';

// --- UTXO Type Definition (Ensure this matches what API/frontend expects) ---
// Added here for clarity within this module, could be moved to a types file
export interface Utxo {
  txid: string;
  vout: number;
  value: number; // Use number for values coming from typical APIs
  scriptPubKey: string; // Hex string
}

// --- Core Interfaces for New Flow ---
export interface InscriptionData {
  contentType: string;
  content: Uint8Array | string;
  parentInscriptionId?: string;
  metadata?: Record<string, string>;
}

// Local interface for relevant P2TR details
export interface CommitP2TRInfo {
  address: string;
  script: Uint8Array;
  internalKey: Uint8Array;
}

// Added type for detailed script info needed for signing
export interface InscriptionScriptInfo {
  script: Uint8Array;
  controlBlock: Uint8Array;
  leafVersion: number;
}

// Return type for prepareInscriptionScripts - Modified to include private key
export interface PreparedInscriptionScripts {
  commitP2TRDetails: CommitP2TRInfo;
  inscriptionLeafScript?: Uint8Array; // Keep the simple leaf script for now
  revealPublicKeyUsed: Uint8Array; // Return the actual x-only key used
  revealPrivateKey: Uint8Array; // Added private key
}

// Params for estimateRevealFee - Reverted
export interface EstimateRevealFeeParams {
    commitP2TRScript: Uint8Array;
    commitAmount: bigint; // The amount expected in the commit UTXO
    destinationAddress: string;
    feeRate: number;
    network: typeof btc.NETWORK;
    inscriptionLeafScript?: Uint8Array; 
}

// Params for constructFinalRevealTx - Reverted
export interface ConstructFinalRevealTxParams {
  /** WIF string for the private key corresponding to the revealPublicKey used in prepareInscriptionScripts. */
  revealSignerWif: string;
  /** The final destination address for the inscription. */
  destinationAddress: string;
  /** The P2TR details for the commit output script. */
  commitP2TRDetails: CommitP2TRInfo; 
  /** The inscription to be revealed. */
  inscription: ordinals.Inscription; 
  /** The actual UTXO details from the user-funded commit transaction. */
  commitUtxo: { 
    txid: string; 
    vout: number; 
    amount: bigint; // Actual amount sent to the commit address
  };
  /** The network object (from @scure/btc-signer). Defaults to bitcoin mainnet. */
  network?: typeof btc.NETWORK;
  /** The pre-calculated fee for this reveal transaction. */
  revealFee: bigint; 
}

// Return type for constructFinalRevealTx
export interface FinalRevealTxResult {
  txHex: string;
  txid: string;
}

// --- Deprecated Interfaces (Originals kept for reference/potential rollback) ---
/** @deprecated Use generateCommitDetails and constructFinalRevealTx instead. */
export interface FindCommitVoutParams { commitTx: string; network: typeof btc.NETWORK; expectedScriptHex?: string; expectedValue?: number; recipientAddress?: string; }
/** @deprecated Related to old PSBT flow */
export interface CreateSignedRevealPsbtParams { commitTxid: string; commitVout: number; commitTxHex: string; unsignedRevealPsbtBase64: string; revealSignerWif: string; network: typeof btc.NETWORK; }
/** @deprecated Related to old PSBT flow */
export interface FinalizeRevealPsbtParams { signedRevealPsbtBase64: string; network: typeof btc.NETWORK; commitTxid?: string; commitVout?: number; }
/** @deprecated Related to old PSBT flow */
export interface CreateRevealPsbtParams { commitTxid: string; commitVout: number; commitTxHex: string; unsignedRevealPsbtBase64: string; revealSignerWif: string; network: typeof btc.NETWORK; leafScriptHex?: string; }
/** @deprecated Used by deprecated generateCommitDetails */
export interface GenerateCommitDetailsParams { revealPublicKey: Uint8Array | string; inscriptionData: InscriptionData; destinationAddress: string; network?: typeof btc.NETWORK; feeRate: number; recoveryPublicKey?: Uint8Array | string; }
/** @deprecated Used by deprecated generateCommitDetails */
export interface CommitDetails { commitAddress: string; requiredCommitAmount: bigint; revealFee: bigint; commitP2TRDetails: CommitP2TRInfo; inscriptionLeafScript?: Uint8Array; }
/** @deprecated Used by deprecated createInscriptionScripts */
export interface InscriptionScripts { output: Uint8Array; address: string; internalKey: Uint8Array; inscriptionScript?: Uint8Array; controlBlock?: Uint8Array; }


// --- Helper Functions ---
function safeBytes(bytes: Uint8Array | ArrayBufferLike): Uint8Array {
  return new Uint8Array(bytes instanceof Uint8Array ? bytes.buffer : bytes);
}
function copyBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}
function validateParams(params: Record<string, any>, requiredParams: string[]): void {
  for (const param of requiredParams) {
    if (!params[param]) {
      throw new Error(`Missing required parameter: ${param}`);
    }
  }
}

// --- Deprecated Functions ---
/** @deprecated Use prepareInscriptionScripts and other functions for the new flow. */
export function findCommitVout(params: FindCommitVoutParams): number { /* ... implementation ... */ return 0; }
/** @deprecated Use prepareInscriptionScripts and other functions for the new flow. */
export function createInscriptionScripts(/* ... */): InscriptionScripts { /* ... implementation ... */ throw new Error("Deprecated"); }
/** @deprecated Use constructFinalRevealTx directly. */
export function createRevealPsbt(params: CreateRevealPsbtParams): string { /* ... implementation ... */ throw new Error("Deprecated"); }
/** @deprecated PSBT handling is refactored. */
function decodePsbtFromBase64(psbtBase64: string): btc.Transaction { /* ... implementation ... */ throw new Error("Deprecated"); }
/** @deprecated Use prepareInscriptionScripts and estimateRevealFee instead. */
export function generateCommitDetails(params: GenerateCommitDetailsParams): CommitDetails { /* ... implementation ... */ throw new Error("Deprecated: Use prepareInscriptionScripts and estimateRevealFee"); }

// --- Constants ---
const DUST_LIMIT = 546n; 
const DUMMY_TXID = '0000000000000000000000000000000000000000000000000000000000000000';
const DUMMY_VOUT = 0;
// Rough estimates for VByte calculation (adjust as needed, especially for different input types)
const VBYTE_OVERHEAD = 10.5; // Segwit marker, version, locktime etc.
const VBYTE_INPUT_P2WPKH = 68; // Approx vbytes for a P2WPKH input
const VBYTE_OUTPUT_P2WPKH = 31; // Approx vbytes for a P2WPKH output
const VBYTE_OUTPUT_P2TR = 43; // Approx vbytes for a P2TR output

// --- NEW FLOW FUNCTIONS ---

// Params for prepareInscriptionScripts
export interface PrepareInscriptionScriptsParams {
  /** The data to inscribe. */
  inscriptionData: InscriptionData;
  /** The network object (from @scure/btc-signer). Defaults to bitcoin mainnet. */
  network?: typeof btc.NETWORK;
  /** Optional: Public key (33-byte compressed or 32-byte x-only) to use for recovery path in commit tx. */
  recoveryPublicKey?: Uint8Array | string;
}

/**
 * Generates the necessary P2TR commit script and inscription leaf script.
 * Does not handle fee calculation or transaction construction.
 * Generates a new key pair internally.
 * 
 * @param params Parameters including inscription data.
 * @returns The commit P2TR details, the inscription leaf script, the x-only reveal key used, and the private key.
 */
export function prepareInscriptionScripts(
  params: PrepareInscriptionScriptsParams
): PreparedInscriptionScripts {
  const {
    inscriptionData,
    network = NETWORKS.bitcoin,
    recoveryPublicKey,
  } = params;
  console.log('[ordinalsplus:prepareInscriptionScripts] Preparing scripts...');
  validateParams(params, ['inscriptionData']);

  // --- Generate Key Pair ---
  const revealPrivateKey = schnorr.utils.randomPrivateKey();
  const revealPublicKeyBytes = schnorr.getPublicKey(revealPrivateKey);
  const xOnlyRevealPublicKey = revealPublicKeyBytes.length === 33 ? revealPublicKeyBytes.slice(1) : revealPublicKeyBytes;
  if (xOnlyRevealPublicKey.length !== 32) {
    throw new Error(`Invalid x-only reveal public key length: ${xOnlyRevealPublicKey.length} (derived from input length ${revealPublicKeyBytes.length})`);
  }
  console.log(`[ordinalsplus:prepareInscriptionScripts] Generated reveal key pair. Public key: ${bytesToHex(xOnlyRevealPublicKey)}`);

  let internalCommitKeyBytes: Uint8Array;
  if (recoveryPublicKey) {
    const recoveryPublicKeyBytes = typeof recoveryPublicKey === 'string' ? hexToBytes(recoveryPublicKey) : copyBytes(recoveryPublicKey);
    internalCommitKeyBytes = recoveryPublicKeyBytes.length === 33 ? recoveryPublicKeyBytes.slice(1) : recoveryPublicKeyBytes;
     if (internalCommitKeyBytes.length !== 32) {
        throw new Error(`Invalid x-only recovery public key length: ${internalCommitKeyBytes.length}`);
     }
  } else {
    internalCommitKeyBytes = xOnlyRevealPublicKey;
  }
  console.log(`[ordinalsplus:prepareInscriptionScripts] Using internal key for commit: ${bytesToHex(internalCommitKeyBytes)}`);

  // --- Prepare Inscription Data ---
  const tags: ordinals.Tags = {
    contentType: inscriptionData.contentType,
    unknown: inscriptionData.metadata
      ? Object.entries(inscriptionData.metadata)
        .map(([key, value]) => [utf8.decode(key), utf8.decode(value)] as [Uint8Array, Uint8Array])
      : undefined,
  };
  const inscription: ordinals.Inscription = {
    tags: tags,
    body: typeof inscriptionData.content === 'string'
      ? utf8.decode(inscriptionData.content)
      : new Uint8Array(inscriptionData.content),
  };
  console.log(`[ordinalsplus:prepareInscriptionScripts] Inscription content type: ${inscription.tags.contentType}, Body size: ${inscription.body.length} bytes`);

  // --- Generate Reveal Script Tree & Leaf ---
  const scriptTree = ordinals.p2tr_ord_reveal(xOnlyRevealPublicKey, [inscription]);
  
  // Extract just the leafScript - simpler approach for now
  let leafScript: Uint8Array | undefined;
  if (typeof scriptTree === 'object' && scriptTree !== null && scriptTree.script instanceof Uint8Array) {
    leafScript = new Uint8Array(scriptTree.script);
     console.log(`[ordinalsplus:prepareInscriptionScripts] Reveal leaf script extracted (length: ${leafScript.length})`);
  // Handle case where it might just be a Uint8Array
  } else if (scriptTree instanceof Uint8Array) {
     leafScript = new Uint8Array(scriptTree);
     console.warn("[ordinalsplus:prepareInscriptionScripts] p2tr_ord_reveal returned only script bytes. Assuming this is the leaf script.");
     console.log(`[ordinalsplus:prepareInscriptionScripts] Reveal leaf script extracted (length: ${leafScript.length})`);
  } else {
    console.error("[ordinalsplus:prepareInscriptionScripts] Could not extract leaf script from scriptTree:", scriptTree);
    throw new Error('Failed to extract reveal leaf script from scriptTree.');
  }

  // --- Generate Commit P2TR Details --- 
  // Ensure the full scriptTree is used here for commit generation
  const commitP2TR = btc.p2tr(
    internalCommitKeyBytes, 
    scriptTree, // Pass the full structure returned by p2tr_ord_reveal
    network,
    false, 
    [ordinals.OutOrdinalReveal]
  );
  if (!commitP2TR.address || !commitP2TR.script) {
    throw new Error('Failed to create P2TR data for commit transaction.');
  }
  console.log(`[ordinalsplus:prepareInscriptionScripts] Commit P2TR Address: ${commitP2TR.address}`);

  // Updated return structure to include private key
  return {
    commitP2TRDetails: {
      address: commitP2TR.address,
      script: new Uint8Array(commitP2TR.script),
      internalKey: new Uint8Array(internalCommitKeyBytes),
    },
    inscriptionLeafScript: leafScript, // Return the simple leaf script
    revealPublicKeyUsed: new Uint8Array(xOnlyRevealPublicKey),
    revealPrivateKey: new Uint8Array(revealPrivateKey),
  };
}

/**
 * Estimates the fee for the reveal transaction.
 * 
 * @param params Parameters including commit details, destination, and fee rate.
 * @returns Estimated fee in satoshis (bigint).
 */
export function estimateRevealFee(params: EstimateRevealFeeParams): bigint {
    const {
        commitP2TRScript,
        commitAmount, // The amount that WILL be in the commit UTXO
        destinationAddress,
        feeRate,
        network,
        inscriptionLeafScript
    } = params;
    console.log(`[ordinalsplus:estimateRevealFee] Estimating fee... Rate: ${feeRate} sat/vB, Commit Amount: ${commitAmount} sats`);
    validateParams(params, ['commitP2TRScript', 'commitAmount', 'destinationAddress', 'feeRate', 'network']);

    if (commitAmount <= DUST_LIMIT) {
        console.warn(`[ordinalsplus:estimateRevealFee] Commit amount (${commitAmount}) is at or below dust limit. Reveal might be impossible or uneconomical.`);
        // Return a minimal fee or throw? Let's return minimal for now.
        // return 1n * BigInt(Math.ceil(feeRate)); // Simplistic minimum
    }

    // Create a dummy reveal transaction
    const dummyRevealTx = new btc.Transaction({ customScripts: [ordinals.OutOrdinalReveal] });

    // Add the dummy commit UTXO as input
    dummyRevealTx.addInput({
        txid: hexToBytes(DUMMY_TXID),
        index: DUMMY_VOUT,
        witnessUtxo: { script: commitP2TRScript, amount: commitAmount },
    });

    // Add the destination output (amount doesn't affect size estimation much, use dust)
    dummyRevealTx.addOutputAddress(destinationAddress, DUST_LIMIT, network);

    // Estimate vsize - Use a similar calculation as before
    // TODO: Refine this vsize estimation.
    try {
        const baseSize = 10; 
        const inputSize = 41;
        const outputSize = 43; 
        
        const controlBlockSize = 33; // Revert to default estimate
        const scriptSize = inscriptionLeafScript ? inscriptionLeafScript.length : 34; // Revert to using leaf script length
        const sigSize = 65;
        const witnessItemsCount = 3; 
        const witnessSize = witnessItemsCount + sigSize + scriptSize + controlBlockSize;

        const estimatedVsize = Math.ceil(baseSize + inputSize + outputSize + witnessSize / 4);
        const calculatedFee = BigInt(Math.ceil(estimatedVsize * feeRate));
        
        // Ensure fee isn't negative or zero if rate is very low / vsize is small
        const finalFee = calculatedFee > 0n ? calculatedFee : 1n; 
        
        console.log(`[ordinalsplus:estimateRevealFee] Estimated Vsize: ${estimatedVsize}, Calculated Fee: ${finalFee} sats`);
        return finalFee;
    } catch (e) {
        console.error(`[ordinalsplus:estimateRevealFee] Error during vsize estimation: ${e}`);
        throw new Error(`Failed to estimate reveal fee size: ${(e as Error).message}`);
    }
}


/**
 * Constructs the final, signed reveal transaction using the actual commit UTXO details.
 * Assumes revealFee was pre-calculated and commitAmount covers it.
 * 
 * @param params - Parameters including commit details, UTXO info, and signer WIF.
 * @returns The signed transaction hex and txid.
 */
export function constructFinalRevealTx(
    params: ConstructFinalRevealTxParams
): FinalRevealTxResult {
  const {
    revealSignerWif,
    destinationAddress,
    commitP2TRDetails, // Receives script details
    inscription, // Use simple leaf script again
    commitUtxo,
    network = NETWORKS.bitcoin,
    revealFee // Expect pre-calculated fee
  } = params;
  
  console.log('[ordinalsplus:constructFinalRevealTx] Constructing final reveal transaction...');
  validateParams(params, ['revealSignerWif', 'destinationAddress', 'commitP2TRDetails', 'commitUtxo', 'network', 'revealFee']);
  
  // Extract commit UTXO details
  const { txid: commitTxid, vout: commitVout, amount: commitAmountSent } = commitUtxo;
  
  if (commitAmountSent < revealFee) {
      // This is a critical error - the commit UTXO doesn't even cover the estimated fee
      throw new Error(`Commit amount (${commitAmountSent} sats) is less than the required reveal fee (${revealFee} sats).`);
  }
  
  // --- 1. Prepare Signer and Output Amount ---
  const revealPrivateKeyBytes = wifToPrivateKeyBytes(revealSignerWif);
  const revealPublicKeyBytes = schnorr.getPublicKey(revealPrivateKeyBytes); 
  const xOnlyRevealPublicKeyBytes = revealPublicKeyBytes.length === 33 ? revealPublicKeyBytes.slice(1) : revealPublicKeyBytes;

  // TODO: Add verification that revealPrivateKeyBytes corresponds to the key used in prepareInscriptionScripts if needed
  
  const revealOutputAmount = commitAmountSent - revealFee;
  if (revealOutputAmount < DUST_LIMIT) {
      console.warn(`[ordinalsplus:constructFinalRevealTx] WARNING: Calculated reveal output amount (${revealOutputAmount} sats) is below dust limit (${DUST_LIMIT} sats). The inscription might be unspendable or hard to spend later.`);
      // Proceed, but log warning. User might intend this for small inscriptions.
  }
  console.log(`[ordinalsplus:constructFinalRevealTx] Reveal output amount: ${revealOutputAmount} sats`);

  // --- 2. Build the Transaction ---
  const customScripts = [ordinals.OutOrdinalReveal];
  const revealPayment = btc.p2tr(
    undefined as any, // internalPubKey
    ordinals.p2tr_ord_reveal(xOnlyRevealPublicKeyBytes, [inscription]), // TaprootScriptTree
    network, // mainnet or testnet
    false, // allowUnknownOutputs, safety feature
    customScripts
  );
  
  const revealTx = new btc.Transaction({ customScripts });
  revealTx.addInput({
    ...revealPayment,
    txid: commitTxid,
    index: commitVout,
    witnessUtxo: { script: revealPayment.script, amount: commitAmountSent }
  });
  console.log(`[ordinalsplus:constructFinalRevealTx] Added input: ${commitTxid}:${commitVout} (Amount: ${commitAmountSent} sats)`);

  revealTx.addOutputAddress(destinationAddress, revealOutputAmount, network);
  console.log(`[ordinalsplus:constructFinalRevealTx] Added output: ${revealOutputAmount} sats to ${destinationAddress}`);

  // --- 3. Sign the Transaction ---
  try {
    console.log(`[ordinalsplus:constructFinalRevealTx] Signing input 0...`);
    // Signing with the tapLeafScript properly included in the input
    revealTx.signIdx(revealPrivateKeyBytes, 0); 
    console.log(`[ordinalsplus:constructFinalRevealTx] Input 0 signed.`);
  } catch (e) {
      console.error(`[ordinalsplus:constructFinalRevealTx] Error signing transaction: ${e}`);
      try {
          const inputData = revealTx.getInput(0);
          console.error("Input Data at Signing Error:", {
              txid: inputData.txid ? bytesToHex(inputData.txid) : 'undefined',
              index: inputData.index,
              witnessUtxo_script: inputData.witnessUtxo?.script ? bytesToHex(inputData.witnessUtxo.script) : 'undefined',
              witnessUtxo_amount: inputData.witnessUtxo?.amount?.toString(),
              tapLeafScript_present: !!inputData.tapLeafScript?.length,
              tapLeafScript_debug: inputData.tapLeafScript ? JSON.stringify(inputData.tapLeafScript) : 'undefined', // Revert debug info
              provided_privKey_corresponds_to_pubKey_xOnly: bytesToHex(xOnlyRevealPublicKeyBytes)
          });
      } catch (logErr) {
          console.error("Error logging input data during signing error:", logErr);
      }
      throw new Error(`Failed to sign reveal transaction: ${(e as Error).message}`);
  }
  

  // --- 4. Finalize and Extract ---
  console.log(`[ordinalsplus:constructFinalRevealTx] Finalizing input 0...`);
  revealTx.finalizeIdx(0);
  console.log(`[ordinalsplus:constructFinalRevealTx] Input 0 finalized.`);

  const finalTxBytes = revealTx.extract();
  const finalTxHex = bytesToHex(finalTxBytes);
  const finalTxid = revealTx.id;
  console.log(`[ordinalsplus:constructFinalRevealTx] Final transaction extracted. Size: ${finalTxBytes.length} bytes, Txid: ${finalTxid}`);

  return {
    txHex: finalTxHex,
    txid: finalTxid,
  };
}

// --- Utility Functions ---

/** @deprecated Use getScureNetwork from utils/networks.ts instead. */
export function getNetwork(networkType: string): typeof btc.NETWORK {
  console.warn("getNetwork function is deprecated. Use getScureNetwork from utils/networks instead.");
  return getScureNetwork(networkType as any);
}

export function deriveP2TR(pubkey: Uint8Array | string, network = NETWORKS.bitcoin) {
  const pubkeyBytes = typeof pubkey === 'string' ? hexToBytes(pubkey) : copyBytes(pubkey);
  const xOnlyPubkey = pubkeyBytes.length === 33 ? new Uint8Array(pubkeyBytes.slice(1)) : new Uint8Array(pubkeyBytes);
  const p2trOutput = btc.p2tr(xOnlyPubkey, undefined, network);
  if (!p2trOutput.address || !p2trOutput.script) {
     throw new Error('Failed to create P2TR key-path data.');
  }
  return {
    output: new Uint8Array(p2trOutput.script),
    address: p2trOutput.address,
    internalKey: new Uint8Array(xOnlyPubkey),
  };
}

export function wifToPrivateKeyBytes(wif: string): Uint8Array {
  const cleanedWif = wif.replace(/[-\s]/g, '');
  let network = NETWORKS.bitcoin;
  try {
    // Try decoding with mainnet first
    const decoder = btc.WIF(NETWORKS.bitcoin);
    const decoded = decoder.decode(cleanedWif);
    console.log(`[wifToPrivateKeyBytes] Decoded WIF for mainnet.`);
    return new Uint8Array(decoded);
  } catch (mainnetError) {
      // Try decoding with testnet/signet if mainnet fails
      try {
          network = NETWORKS.testnet; // testnet and signet share prefix?
          const decoder = btc.WIF(network);
          const decoded = decoder.decode(cleanedWif);
          console.log(`[wifToPrivateKeyBytes] Decoded WIF for testnet/signet.`);
          return new Uint8Array(decoded);
      } catch (testnetError) {
          console.error(`Failed to decode WIF '${cleanedWif}' with mainnet or testnet/signet:`, mainnetError, testnetError);
          throw new Error(`Could not decode WIF '${cleanedWif}'. Invalid format or unsupported network.`);
      }
  }
}

export function wifToPrivateKey(wif: string): string {
  const privateKeyBytes = wifToPrivateKeyBytes(wif);
  return bytesToHex(privateKeyBytes);
}

// --- Interfaces for createUnsignedCommitPsbt --- 
export interface CreateUnsignedCommitPsbtParams {
    selectedUtxos: Utxo[]; // Use the Utxo interface defined above
    commitAddress: string;
    requiredCommitAmount: bigint; // Amount needed for the commit output
    changeAddress: string;
    feeRate: number; // Sats per vByte
    network: typeof btc.NETWORK;
}

export interface CreateUnsignedCommitPsbtResult {
    unsignedPsbtBase64: string;
    calculatedFee: bigint;
}

// --- createUnsignedCommitPsbt --- 
/**
 * Creates an unsigned PSBT for the commit transaction.
 * 
 * @param params Parameters including UTXOs, addresses, amounts, fee rate.
 * @returns Base64 encoded unsigned PSBT and the calculated fee.
 */
export function createUnsignedCommitPsbt(
    params: CreateUnsignedCommitPsbtParams
): CreateUnsignedCommitPsbtResult {
    const {
        selectedUtxos,
        commitAddress,
        requiredCommitAmount,
        changeAddress,
        feeRate,
        network
    } = params;
    console.log('[ordinalsplus:createUnsignedCommitPsbt] Creating commit PSBT...');
    validateParams(params, ['selectedUtxos', 'commitAddress', 'requiredCommitAmount', 'changeAddress', 'feeRate', 'network']);

    if (selectedUtxos.length === 0) {
        throw new Error("Cannot create commit transaction: No UTXOs provided.");
    }
    if (requiredCommitAmount <= DUST_LIMIT) {
         console.warn(`[ordinalsplus:createUnsignedCommitPsbt] Required commit amount (${requiredCommitAmount}) is at or below dust limit.`);
         // Allow creation but warn, as this amount is typically for the reveal output + fee
    }

    const tx = new btc.Transaction();
    let totalInputValue = 0n;

    // Add Inputs
    for (const utxo of selectedUtxos) {
        if (!utxo.scriptPubKey || utxo.value === undefined) {
             console.warn(`[ordinalsplus:createUnsignedCommitPsbt] Skipping UTXO ${utxo.txid}:${utxo.vout} due to missing scriptPubKey or value.`);
             continue; // Skip invalid UTXOs
        }
        tx.addInput({
            txid: hexToBytes(utxo.txid),
            index: utxo.vout,
            // Assuming inputs are P2WPKH or P2TR, requiring witness UTXO
            // If legacy inputs are possible, nonWitnessUtxo is needed
            witnessUtxo: {
                script: hexToBytes(utxo.scriptPubKey),
                amount: BigInt(utxo.value), // Convert number to bigint
            },
            // Add sighashType if needed, defaults might be ok for standard signing
        });
        totalInputValue += BigInt(utxo.value);
    }

    if (tx.inputsLength === 0) {
        throw new Error("Cannot create commit transaction: No valid UTXOs were added.");
    }
    console.log(`[ordinalsplus:createUnsignedCommitPsbt] Added ${tx.inputsLength} inputs with total value: ${totalInputValue} sats`);

    // Add Commit Output (target for inscription)
    tx.addOutputAddress(commitAddress, requiredCommitAmount, network);
    console.log(`[ordinalsplus:createUnsignedCommitPsbt] Added commit output: ${requiredCommitAmount} sats to ${commitAddress}`);

    // Estimate Fee and Calculate Change
    // Simple estimation: assumes all inputs are P2WPKH, commit is P2TR, change is P2WPKH
    // TODO: Make estimation more robust if different script types are common
    const estimatedVBytes = Math.ceil(
        VBYTE_OVERHEAD +
        (tx.inputsLength * VBYTE_INPUT_P2WPKH) +
        VBYTE_OUTPUT_P2TR + // The commit output
        VBYTE_OUTPUT_P2WPKH   // The potential change output
    );
    const calculatedFee = BigInt(Math.ceil(estimatedVBytes * feeRate));
    console.log(`[ordinalsplus:createUnsignedCommitPsbt] Estimated VBytes: ${estimatedVBytes}, Calculated Fee: ${calculatedFee} sats`);

    const changeAmount = totalInputValue - requiredCommitAmount - calculatedFee;
    console.log(`[ordinalsplus:createUnsignedCommitPsbt] Calculated Change: ${changeAmount} sats`);

    if (changeAmount < 0n) {
        throw new Error(`Insufficient funds. Required: ${requiredCommitAmount} + Fee: ${calculatedFee} = ${requiredCommitAmount + calculatedFee}, Available: ${totalInputValue}`);
    }

    // Add Change Output (if above dust limit)
    if (changeAmount >= DUST_LIMIT) {
        tx.addOutputAddress(changeAddress, changeAmount, network);
        console.log(`[ordinalsplus:createUnsignedCommitPsbt] Added change output: ${changeAmount} sats to ${changeAddress}`);
    } else {
        console.log(`[ordinalsplus:createUnsignedCommitPsbt] Change amount ${changeAmount} is below dust limit, adding to fee.`);
        // If change is dust, it implicitly becomes part of the fee
    }

    // Final Fee includes dust change if applicable
    const finalCalculatedFee = totalInputValue - requiredCommitAmount - (changeAmount >= DUST_LIMIT ? changeAmount : 0n);
     console.log(`[ordinalsplus:createUnsignedCommitPsbt] Final Calculated Fee (including dust): ${finalCalculatedFee} sats`);

    // Convert to PSBT
    try {
        const psbtBytes = tx.toPSBT(0); // PSBT version 0
        const unsignedPsbtBase64 = base64.encode(psbtBytes);
        console.log("[ordinalsplus:createUnsignedCommitPsbt] PSBT created successfully.");

        return {
            unsignedPsbtBase64,
            calculatedFee: finalCalculatedFee, // Return the fee calculated based on outputs added
        };
    } catch (e) {
        console.error(`[ordinalsplus:createUnsignedCommitPsbt] Error converting transaction to PSBT: ${e}`);
        throw new Error(`Failed to create PSBT: ${(e as Error).message}`);
    }
}

export { hex, schnorr, sha256, bytesToHex, hexToBytes, concatBytes, utf8 };