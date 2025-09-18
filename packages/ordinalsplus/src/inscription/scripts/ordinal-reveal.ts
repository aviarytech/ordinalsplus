/**
 * Ordinal Inscription Script Generation
 * 
 * This module implements the core inscription script generation 
 * functionality using the micro-ordinals approach.
 */

import * as btc from '@scure/btc-signer';
import * as ordinals from 'micro-ordinals';
import { utf8 } from '@scure/base';
import { schnorr } from '@noble/curves/secp256k1';
import { BitcoinNetwork } from '../../types';
import { InscriptionContent } from '../content/mime-handling';
import { P2TRAddressInfo, P2TRKeyPair } from '../p2tr/key-utils';
import { NETWORKS, getScureNetwork } from '../../utils/networks';

/**
 * Interface representing an ordinal inscription, matching micro-ordinals' Inscription type
 */
export interface OrdinalInscription {
  /** Tags for the inscription including contentType and metadata */
  tags: ordinals.Tags;
  /** Binary content of the inscription */
  body: Uint8Array;
}

/**
 * Detailed information about a script for inscription reveal
 */
export interface InscriptionScriptInfo {
  /** The complete script */
  script: Uint8Array;
  /** The control block needed for script-path spending */
  controlBlock: Uint8Array;
  /** Taproot leaf version */
  leafVersion: number;
}

/**
 * Complete information for a prepared inscription
 */
export interface PreparedInscription {
  /** The P2TR address details for the commit transaction */
  commitAddress: P2TRAddressInfo;
  /** The content and inscription details */
  inscription: OrdinalInscription;
  /** The public key used for the reveal transaction */
  revealPublicKey: Uint8Array;
  /** The private key for the reveal transaction (if generated internally) */
  revealPrivateKey?: Uint8Array;
  /** The inscription script details */
  inscriptionScript: InscriptionScriptInfo;
}

/**
 * Complete information for a prepared batch inscription (multiple inscriptions in one reveal)
 */
export interface PreparedBatchInscription {
  /** The P2TR address details for the commit transaction */
  commitAddress: P2TRAddressInfo;
  /** The inscriptions to embed in a single witness */
  inscriptions: OrdinalInscription[];
  /** The public key used for the reveal transaction */
  revealPublicKey: Uint8Array;
  /** The private key for the reveal transaction (if generated internally) */
  revealPrivateKey?: Uint8Array;
  /** The inscription script details */
  inscriptionScript: InscriptionScriptInfo;
}

/**
 * Converts InscriptionContent to the OrdinalInscription format used by micro-ordinals
 * 
 * @param content - The prepared inscription content
 * @returns An OrdinalInscription object compatible with micro-ordinals
 */
export function createOrdinalInscription(content: InscriptionContent): OrdinalInscription {
  // Build the tags object
  const tags: ordinals.Tags = {
    contentType: content.contentType,
  };
  
  // For metadata, pass the raw object to micro-ordinals which will handle CBOR encoding automatically
  // DO NOT pre-encode with CBOR since micro-ordinals already does this for the metadata field (tag 5)
  if (content.metadata && Object.keys(content.metadata).length > 0) {
    console.log(`[createOrdinalInscription] Adding metadata to tags:`, content.metadata);
    
    // Pass raw metadata object - micro-ordinals will CBOR-encode it automatically
    // This ensures ordinals.com displays it as readable JSON instead of double-encoded hex
    tags.metadata = content.metadata;
  }
  
  const inscription: ordinals.Inscription = {
    tags,
    body: content.content
  };

  // If a pointer was provided, include it to target a specific sat offset
  if (typeof content.pointer !== 'undefined') {
    (inscription.tags as any).pointer = content.pointer;
  }

  return inscription as OrdinalInscription;
}

/**
 * Generates the inscription script using the micro-ordinals p2tr_ord_reveal approach
 * 
 * @param revealPublicKey - The public key for the reveal transaction (x-only, 32 bytes)
 * @param inscription - The ordinal inscription to embed
 * @returns The script tree for the inscription
 */
export function generateInscriptionScript(
  revealPublicKey: Uint8Array,
  inscription: OrdinalInscription
): any {  // Using 'any' for now since micro-ordinals doesn't export TaprootScriptTree type
  // Check public key format
  if (revealPublicKey.length !== 32) {
    throw new Error(`Invalid x-only reveal public key length: ${revealPublicKey.length}`);
  }
  
  // Generate the script tree using micro-ordinals
  return ordinals.p2tr_ord_reveal(revealPublicKey, [inscription]);
}

/**
 * Generates the inscription script for multiple inscriptions using micro-ordinals
 */
export function generateBatchInscriptionScript(
  revealPublicKey: Uint8Array,
  inscriptions: OrdinalInscription[]
): any {
  if (revealPublicKey.length !== 32) {
    throw new Error(`Invalid x-only reveal public key length: ${revealPublicKey.length}`);
  }
  if (!Array.isArray(inscriptions) || inscriptions.length === 0) {
    throw new Error('At least one inscription is required');
  }
  return ordinals.p2tr_ord_reveal(revealPublicKey, inscriptions);
}

/**
 * Retrieves detailed script information from the taproot output generated
 * by `@scure/btc-signer`. This ensures the reveal step reuses the exact
 * script and control block that were included in the commit address.
 *
 * @param p2trOutput - Result from btc.p2tr containing tapLeafScript data
 * @returns Detailed information about the inscription script
 */
export function extractScriptInfoFromP2TR(p2trOutput: any): InscriptionScriptInfo {
  if (!p2trOutput || !p2trOutput.leaves || p2trOutput.leaves.length === 0) {
    throw new Error('Invalid p2tr output: missing taproot leaves');
  }

  const leaf = p2trOutput.leaves[0];
  const leafVersion = leaf.version ?? 0xc0;

  return {
    script: leaf.script,
    controlBlock: leaf.controlBlock,
    leafVersion
  };
}

/**
 * Parameters for preparing an inscription
 */
export interface PrepareInscriptionParams {
  /** The content to inscribe */
  content: InscriptionContent;
  /** The public key for the reveal transaction (if providing your own) */
  revealPublicKey?: Uint8Array;
  /** The Bitcoin network to use */
  network?: BitcoinNetwork;
  /** The recovery public key to use for the commit address (optional) */
  recoveryPublicKey?: Uint8Array;
}

/**
 * Prepares an inscription by generating all necessary components
 * 
 * @param params - Parameters for inscription preparation
 * @returns Complete information for a prepared inscription
 */
export function prepareInscription(params: PrepareInscriptionParams): PreparedInscription {
  const { 
    content, 
    revealPublicKey, 
    network = 'mainnet',
    recoveryPublicKey
  } = params;
  
  // Convert content to OrdinalInscription format
  const ordinalInscription = createOrdinalInscription(content);
  
  // Generate a key pair if not provided
  let pubKey: Uint8Array;
  let privKey: Uint8Array | undefined;
  
  if (!revealPublicKey) {
    // Generate a random key pair using noble-curves
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);
    
    console.log(`[prepareInscription] Generated private key: ${Buffer.from(privateKey).toString('hex')}`);
    
    const fullPubKey = schnorr.getPublicKey(privateKey);
    console.log(`[prepareInscription] Generated full public key: ${Buffer.from(fullPubKey).toString('hex')}`);
    
    // Convert to x-only key
    pubKey = fullPubKey.length === 33 ? fullPubKey.slice(1) : fullPubKey;
    console.log(`[prepareInscription] X-only public key: ${Buffer.from(pubKey).toString('hex')}`);
    
    // Verify the key is not all zeros
    const isAllZeros = pubKey.every(byte => byte === 0);
    if (isAllZeros) {
      console.error('[prepareInscription] ERROR: Generated public key is all zeros!');
    }
    
    privKey = privateKey;
  } else {
    pubKey = revealPublicKey;
    console.log(`[prepareInscription] Using provided public key: ${Buffer.from(pubKey).toString('hex')}`);
    
    // Verify the key is not all zeros
    const isAllZeros = pubKey.every(byte => byte === 0);
    if (isAllZeros) {
      console.error('[prepareInscription] ERROR: Provided public key is all zeros!');
    }
  }
  
  // Generate the inscription script tree
  const scriptTree = generateInscriptionScript(pubKey, ordinalInscription);

  // Use the recovery key if provided, otherwise use the reveal key
  // Also add validation to ensure we never use a zero key
  let internalKey: Uint8Array;
  
  if (recoveryPublicKey && !recoveryPublicKey.every(byte => byte === 0)) {
    internalKey = recoveryPublicKey;
    console.log(`[prepareInscription] Using recovery public key as internal key: ${Buffer.from(internalKey).toString('hex')}`);
  } else {
    internalKey = pubKey;
    console.log(`[prepareInscription] Using reveal public key as internal key: ${Buffer.from(internalKey).toString('hex')}`);
  }
  
  // Add an additional verification step
  const isInternalKeyAllZeros = internalKey.every(byte => byte === 0);
  if (isInternalKeyAllZeros) {
    console.error('[prepareInscription] ERROR: Internal key is all zeros! This should never happen with the validation logic.');
    // If we still somehow have a zero key, generate a new random one as a last resort
    const emergencyKey = new Uint8Array(32);
    crypto.getRandomValues(emergencyKey);
    const emergencyPubKey = schnorr.getPublicKey(emergencyKey);
    internalKey = emergencyPubKey.length === 33 ? emergencyPubKey.slice(1) : emergencyPubKey;
    console.log(`[prepareInscription] EMERGENCY: Generated new internal key: ${Buffer.from(internalKey).toString('hex')}`);
  }

  // Get network object
  const btcNetwork = getScureNetwork(network);

  // Create P2TR address and taproot details using the actual internal key
  const p2tr = btc.p2tr(
    internalKey,
    scriptTree,
    btcNetwork,
    false,
    [ordinals.OutOrdinalReveal]
  );

  if (!p2tr.address) {
    throw new Error('Failed to create P2TR address for commit transaction');
  }

  // Extract detailed script information directly from p2tr output
  const scriptInfo = extractScriptInfoFromP2TR(p2tr);
  
  // Create script from output
  const script = p2tr.script || btc.OutScript.encode({ type: 'tr', pubkey: internalKey });
  
  // Final verification before returning
  console.log(`[prepareInscription] Commit address: ${p2tr.address}`);
  console.log(`[prepareInscription] Commit script hex: ${Buffer.from(script).toString('hex')}`);
  console.log(`[prepareInscription] Inscription script hex: ${Buffer.from(scriptInfo.script).toString('hex')}`);
  console.log(`[prepareInscription] Control block hex: ${Buffer.from(scriptInfo.controlBlock).toString('hex')}`);
  
  return {
    commitAddress: {
      address: p2tr.address,
      script: script,
      internalKey
    },
    inscription: ordinalInscription,
    revealPublicKey: pubKey,
    revealPrivateKey: privKey,
    inscriptionScript: scriptInfo
  };
} 

/**
 * Parameters for preparing a batch inscription (single commit/reveal with many inscriptions)
 */
export interface PrepareBatchInscriptionParams {
  /** The contents to inscribe */
  contents: InscriptionContent[];
  /** The public key for the reveal transaction (if providing your own) */
  revealPublicKey?: Uint8Array;
  /** The Bitcoin network to use */
  network?: BitcoinNetwork;
  /** The recovery public key to use for the commit address (optional) */
  recoveryPublicKey?: Uint8Array;
}

/**
 * Prepares a batch inscription by generating a single script that includes multiple inscriptions
 */
export function prepareBatchInscription(params: PrepareBatchInscriptionParams): PreparedBatchInscription {
  const {
    contents,
    revealPublicKey,
    network = 'mainnet',
    recoveryPublicKey
  } = params;

  if (!Array.isArray(contents) || contents.length === 0) {
    throw new Error('contents must include at least one InscriptionContent');
  }

  // Convert contents to OrdinalInscription[]
  const ordinalInscriptions = contents.map((c) => createOrdinalInscription(c));

  // Generate a key pair if not provided
  let pubKey: Uint8Array;
  let privKey: Uint8Array | undefined;

  if (!revealPublicKey) {
    const privateKey = new Uint8Array(32);
    crypto.getRandomValues(privateKey);
    const fullPubKey = schnorr.getPublicKey(privateKey);
    pubKey = fullPubKey.length === 33 ? fullPubKey.slice(1) : fullPubKey;
    privKey = privateKey;
  } else {
    pubKey = revealPublicKey;
  }

  // Build script tree for all inscriptions
  const scriptTree = generateBatchInscriptionScript(pubKey, ordinalInscriptions);

  // Choose internal key
  let internalKey: Uint8Array;
  if (recoveryPublicKey && !recoveryPublicKey.every((b) => b === 0)) {
    internalKey = recoveryPublicKey;
  } else {
    internalKey = pubKey;
  }

  const btcNetwork = getScureNetwork(network);
  const p2tr = btc.p2tr(
    internalKey,
    scriptTree,
    btcNetwork,
    false,
    [ordinals.OutOrdinalReveal]
  );

  if (!p2tr.address) {
    throw new Error('Failed to create P2TR address for batch commit transaction');
  }

  const scriptInfo = extractScriptInfoFromP2TR(p2tr);
  const script = p2tr.script || btc.OutScript.encode({
    type: 'tr',
    pubkey: internalKey
  });

  return {
    commitAddress: {
      address: p2tr.address,
      script,
      internalKey
    },
    inscriptions: ordinalInscriptions,
    revealPublicKey: pubKey,
    revealPrivateKey: privKey,
    inscriptionScript: scriptInfo
  };
}