/**
 * Ordinal Inscription Script Generation
 * 
 * This module implements the core inscription script generation 
 * functionality using the micro-ordinals approach.
 */

import * as btc from '@scure/btc-signer';
import * as ordinals from 'micro-ordinals';
import { utf8 } from '@scure/base';
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
  
  return {
    tags,
    body: content.content
  };
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
    
    const { schnorr } = require('@noble/curves/secp256k1');
    const fullPubKey = schnorr.getPublicKey(privateKey);
    
    // Convert to x-only key
    pubKey = fullPubKey.length === 33 ? fullPubKey.slice(1) : fullPubKey;
    
    // Verify the key is not all zeros
    const isAllZeros = pubKey.every(byte => byte === 0);
    if (isAllZeros) {
      throw new Error('Generated public key is invalid (all zeros). This indicates a critical error in key generation.');
    }
    
    privKey = privateKey;
  } else {
    pubKey = revealPublicKey;
    
    // Verify the key is not all zeros
    const isAllZeros = pubKey.every(byte => byte === 0);
    if (isAllZeros) {
      throw new Error('Provided public key is invalid (all zeros).');
    }
  }
  
  // Generate the inscription script tree
  const scriptTree = generateInscriptionScript(pubKey, ordinalInscription);

  // Use the recovery key if provided, otherwise use the reveal key
  let internalKey: Uint8Array;
  
  if (recoveryPublicKey) {
    // Validate recovery key is not all zeros
    if (recoveryPublicKey.every(byte => byte === 0)) {
      throw new Error('Provided recovery public key is invalid (all zeros).');
    }
    internalKey = recoveryPublicKey;
  } else {
    internalKey = pubKey;
  }
  
  // Final validation to ensure we never use a zero key
  const isInternalKeyAllZeros = internalKey.every(byte => byte === 0);
  if (isInternalKeyAllZeros) {
    throw new Error('Internal key is invalid (all zeros). This indicates a critical error in key validation logic.');
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
  const script = p2tr.script || btc.OutScript.encode({
    type: 'tr',
    pubkey: internalKey
  });
  
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