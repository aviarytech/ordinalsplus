// Service for constructing inscription PSBTs
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import type { 
    PsbtResponse, 
    GenericInscriptionRequest, 
    DidInscriptionRequest, 
    Utxo,                  // Import Utxo
    NetworkType,           // Import NetworkType
    CombinedPsbtResponse,   // Import CombinedPsbtResponse
    CreatePsbtsRequest
} from '../types';
import type { Payment } from 'bitcoinjs-lib'; // Only import Payment

// Import directly from the module paths - using relative paths
import { 
  createInscriptionPsbts as createInscriptionPsbtsFn,
  calculateTxFee as calculateTxFeeFn,
  getBitcoinJsNetwork
} from 'ordinalsplus';

type BitcoinNetwork = 'mainnet' | 'signet' | 'testnet';

// Import types - using type-only imports

// Initialize factories
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// TODO: Make network, fees, and dummy UTXO values configurable via environment variables
const network = bitcoin.networks.testnet;

// --- Define Custom Signet Network (Backend - Copied from index.ts) --- 
const signetNetwork: bitcoin.networks.Network = {
  messagePrefix: '\x18Bitcoin Signed Message:\n',
  bech32: 'tb',
  bip32: { public: 0x045f1cf6, private: 0x045f18bc },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef,
  // @ts-ignore 
  magic: 0x0a03cf40 
};
// --- End Signet Network ---

interface InscriptionData {
  contentType: Buffer;
  content: Buffer;
  parentInscriptionId?: string;
  metadata?: Record<string, string>;
}

// Helper function to create Buffer with compact size prefix for data pushes
function pushData(data: Buffer): Buffer {
  const length = data.length;
  if (length < bitcoin.opcodes.OP_PUSHDATA1!) {
    return Buffer.concat([Buffer.from([length]), data]);
  } else if (length < 0x100) {
    return Buffer.concat([Buffer.from([bitcoin.opcodes.OP_PUSHDATA1!, length]), data]);
  } else if (length < 0x10000) {
    const buffer = Buffer.allocUnsafe(2);
    buffer.writeUInt16LE(length, 0);
    return Buffer.concat([Buffer.from([bitcoin.opcodes.OP_PUSHDATA2!]), buffer, data]);
  } else {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(length, 0);
    return Buffer.concat([Buffer.from([bitcoin.opcodes.OP_PUSHDATA4!]), buffer, data]);
  }
}

/**
 * Creates the inscription script (Ordinals envelope) manually.
 */
function createInscriptionScript(pubkey: Buffer, inscription: InscriptionData): Payment {
  const protocolId = Buffer.from('ord');

  // Manually build the script parts for the body
  const scriptParts: Buffer[] = [
    Buffer.from([bitcoin.opcodes.OP_FALSE!, bitcoin.opcodes.OP_IF!]), 
    pushData(protocolId)
  ];

  // Add pointer tag if present
  if (inscription.parentInscriptionId) {
    scriptParts.push(pushData(Buffer.from('/p', 'utf8')));
    scriptParts.push(pushData(Buffer.from(inscription.parentInscriptionId, 'utf8')));
  }

  // Add metadata tag if present
  if (inscription.metadata && Object.keys(inscription.metadata).length > 0) {
    try {
        const metadataJson = JSON.stringify(inscription.metadata);
        scriptParts.push(pushData(Buffer.from('/meta', 'utf8')));
        scriptParts.push(pushData(Buffer.from(metadataJson, 'utf8')));
    } catch (jsonError) {
        console.error("[createInscriptionScript] Error stringifying metadata:", jsonError);
    }
  }

  // Add content type tag
  scriptParts.push(Buffer.from([bitcoin.opcodes.OP_1!])); 
  scriptParts.push(pushData(inscription.contentType));

  // Add content data push
  scriptParts.push(Buffer.from([bitcoin.opcodes.OP_0!])); 
  scriptParts.push(pushData(inscription.content));

  // Add ENDIF
  scriptParts.push(Buffer.from([bitcoin.opcodes.OP_ENDIF!])); 

  // Combine parts for the body script
  const bodyScript = Buffer.concat(scriptParts);

  // Full script: <pubkey> OP_CHECKSIG <bodyScript>
  const inscriptionScript = Buffer.concat([
      pushData(pubkey),
      Buffer.from([bitcoin.opcodes.OP_CHECKSIG!]), 
      bodyScript
  ]);
  
  console.log('[createInscriptionScript] Manually Compiled Script:', inscriptionScript.toString('hex'));

  const internalPubkey = pubkey.subarray(1, 33); 

  // *** THIS IS THE PROBLEMATIC CALL ***
  // It returns p2tr object with p2tr.redeem === undefined
  return bitcoin.payments.p2tr({ 
      internalPubkey,
      scriptTree: { output: inscriptionScript }, 
      network 
  });
}

/**
 * Creates the inscription script and returns parts needed for P2TR output and PSBT input.
 */
interface InscriptionScripts {
  address: string;
  output: Buffer; // The scriptPubKey for the commit transaction output
  inscriptionScript: Buffer; // The actual redeem script (Ordinals envelope)
  internalPubkey: Buffer; // The x-only internal public key (32 bytes)
  controlBlock: Buffer; // The control block needed for the reveal input
  leafVersion: number; // Leaf version (e.g., LEAF_VERSION_TAPSCRIPT)
}

function createInscriptionScripts(pubkey: Buffer, inscription: InscriptionData): InscriptionScripts {
  // Add guard clause for pubkey length
  if (pubkey.length !== 33) {
      throw new Error(`[createInscriptionScripts] Invalid pubkey length: Expected 33, got ${pubkey.length}`);
  }

  const protocolId = Buffer.from('ord');

  // Manually build the script parts for the body
  const scriptParts: Buffer[] = [
    Buffer.from([bitcoin.opcodes.OP_FALSE!, bitcoin.opcodes.OP_IF!]), 
    pushData(protocolId)
  ];

  // Add pointer tag if present
  if (inscription.parentInscriptionId) {
    scriptParts.push(pushData(Buffer.from('/p', 'utf8')));
    scriptParts.push(pushData(Buffer.from(inscription.parentInscriptionId, 'utf8')));
  }

  // Add metadata tag if present
  if (inscription.metadata && Object.keys(inscription.metadata).length > 0) {
    try {
        const metadataJson = JSON.stringify(inscription.metadata);
        scriptParts.push(pushData(Buffer.from('/meta', 'utf8')));
        scriptParts.push(pushData(Buffer.from(metadataJson, 'utf8')));
    } catch (jsonError) {
        console.error("[createInscriptionScripts] Error stringifying metadata:", jsonError);
    }
  }

  // Add content type tag
  scriptParts.push(Buffer.from([bitcoin.opcodes.OP_1!])); 
  scriptParts.push(pushData(inscription.contentType));

  // Add content data push
  scriptParts.push(Buffer.from([bitcoin.opcodes.OP_0!])); 
  scriptParts.push(pushData(inscription.content));

  // Add ENDIF
  scriptParts.push(Buffer.from([bitcoin.opcodes.OP_ENDIF!])); 

  // Combine parts for the body script
  const bodyScript = Buffer.concat(scriptParts);

  // Full script: <pubkey> OP_CHECKSIG <bodyScript>
  const inscriptionScript = Buffer.concat([
      pushData(pubkey),
      Buffer.from([bitcoin.opcodes.OP_CHECKSIG!]), 
      bodyScript
  ]);
  
  console.log('[createInscriptionScripts] Manually Compiled Script:', inscriptionScript.toString('hex'));

  // Extract the 32-byte x-only internal public key
  const internalPubkey = pubkey.subarray(1, 33);

  // const leafVersion = bitcoin.script.LEAF_VERSION_TAPSCRIPT; // Typically 0xc0 (192)
  const leafVersion = 0xc0; // Use literal value for TapScript leaf version

  const p2tr = bitcoin.payments.p2tr({
      internalPubkey,
      scriptTree: { output: inscriptionScript }, // Single leaf script
      network,
      // We don't need witness or redeem here as we are constructing, not spending
  });

  // Calculate Control Block
  // Parity is 0 if the full public key's y-coordinate is even (0x02 prefix), 1 if odd (0x03 prefix)
  const parity = pubkey[0]! & 1; // Get the last bit of the first byte (0x02 -> 0, 0x03 -> 1)
  const controlByte = leafVersion | parity;
  const controlBlock = Buffer.concat([Buffer.from([controlByte]), internalPubkey]);

  console.log('[createInscriptionScripts] Calculated Control Block:', controlBlock.toString('hex'));

  // Return all necessary parts
  if (!p2tr.address || !p2tr.output) {
      throw new Error('Failed to generate P2TR address/output script');
  }
  return {
      address: p2tr.address,
      output: p2tr.output, // This is the commitOutputScript (scriptPubKey)
      inscriptionScript: inscriptionScript, // This is the redeemScript
      internalPubkey: internalPubkey,
      controlBlock: controlBlock,
      leafVersion: leafVersion
  };
}

/**
 * Estimates the virtual size of the reveal transaction.
 * DEPRECATED: This is too simplistic and doesn't account for witness data size.
 */
/*
function estimateRevealTxVsize(numInputs: number, numOutputs: number): number {
    const baseVsize = 11;
    const inputVsize = 68 * numInputs;
    const outputVsize = 43 * numOutputs;
    return baseVsize + inputVsize + outputVsize;
}
*/

/**
 * Constructs the reveal transaction PSBT for a generic inscription or linked resource.
 * 
 * Note: This legacy function is maintained for backward compatibility.
 * It should be updated to accept UTXOs and network type, then use
 * the createInscriptionPsbtsFn function internally.
 */
export async function constructGenericPsbt(request: GenericInscriptionRequest): Promise<PsbtResponse> {
    console.log('[psbtService] constructGenericPsbt: Starting PSBT construction for generic inscription...');
    try {
        // This function needs to be updated to accept UTXOs and network type
        // For now, we'll return a placeholder response and update later
        throw new Error('This function needs to be updated to use createInscriptionPsbtsFn from ordinalsplus package');
        
        /* 
        // Example of how this could work if we had the required parameters:
        const result = await createInscriptionPsbtsFn({
            contentType: request.contentType,
            content: Buffer.from(request.contentBase64, 'base64'),
            feeRate: request.feeRate,
            recipientAddress: request.recipientAddress,
            utxos: utxos, // Need to fetch these
            changeAddress: changeAddress, // Need to get this
            network: networkType // Need to determine this
        });
        
        return {
            psbtBase64: result.unsignedRevealPsbtBase64,
            commitTxOutputValue: result.commitTxOutputValue,
            revealFee: result.revealFee,
            revealSignerPrivateKeyWif: result.revealSignerWif
        };
        */
    } catch (error) {
        console.error('[psbtService] constructGenericPsbt: Error constructing PSBT:', error);
        throw error;
    }
}

/**
 * Constructs the reveal transaction PSBT for a DID inscription.
 * 
 * Note: This legacy function is maintained for backward compatibility.
 */
export async function constructDidPsbt(request: DidInscriptionRequest): Promise<PsbtResponse> {
    // DID inscriptions are just a specialized type of generic inscription
    return constructGenericPsbt(request);
}

/**
 * Creates both commit and reveal PSBTs for an inscription using the ordinalsplus package.
 */
export async function createInscriptionPsbts(request: CreatePsbtsRequest): Promise<CombinedPsbtResponse> {
    console.log('[psbtService] createInscriptionPsbts: Starting creation of inscription PSBTs...');
    try {
        // Convert API request type to the Bitcoin network type expected by the package
        const networkType = request.networkType as BitcoinNetwork;
        
        // Map the API request type to the format expected by the ordinalsplus package
        const result = await createInscriptionPsbtsFn({
            contentType: request.contentType,
            content: Buffer.from(request.contentBase64, 'base64'),
            feeRate: request.feeRate,
            recipientAddress: request.recipientAddress,
            utxos: request.utxos,
            changeAddress: request.changeAddress,
            network: networkType,
            testMode: request.testMode // Pass the testMode parameter
        });
        
       
        console.error(`ISSUE: createSignedRevealPsbt is not a function`);
        // // Determine the appropriate scure network
        // const scureNetwork = networkType === 'mainnet' ? 
        //     NETWORKS.bitcoin : 
        //     networkType === 'signet' ? 
        //     NETWORKS.signet : 
        //     NETWORKS.testnet;
        
        // // Use the WIF to sign the reveal PSBT with our scure implementation
        // console.log('[psbtService] Signing reveal PSBT with scure implementation...');
        // const signedRevealPsbtBase64 = createSignedRevealPsbt({
        //     commitTxid: 'dummy', // Will be replaced before broadcast
        //     commitVout: 0,       // Will be replaced before broadcast
        //     commitTxHex: '',     // Will be filled in by the client
        //     unsignedRevealPsbtBase64: result.unsignedRevealPsbtBase64,
        //     revealSignerWif: result.revealSignerWif,
        //     network: scureNetwork
        // });
        
        // // Optionally, for testing purposes, we could also try finalizing the PSBT
        // if (process.env.ENABLE_FINALIZE_TEST === 'true') {
        //     try {
        //         const finalizedTxHex = finalizeRevealPsbt({
        //             signedRevealPsbtBase64,
        //             network: scureNetwork
        //         });
        //         console.log('[psbtService] Successfully finalized reveal PSBT with scure implementation');
        //         console.log(`[psbtService] Finalized TX hex length: ${finalizedTxHex.length / 2} bytes`);
        //     } catch (finalizeError) {
        //         console.warn('[psbtService] Finalize test failed:', finalizeError);
        //         // This is just a test, so we don't fail the overall process if it fails
        //     }
        // }
        
        // Return the result with the same format expected by callers
        return {
            commitPsbtBase64: result.commitPsbtBase64 || '', // Add fallback for test mode
            unsignedRevealPsbtBase64: result.unsignedRevealPsbtBase64,
            revealSignerWif: result.revealSignerWif,
            commitTxOutputValue: result.commitTxOutputValue || 0,
            revealFee: result.revealFee || 0
        };
    } catch (error) {
        console.error('[psbtService] createInscriptionPsbts: Error creating PSBTs:', error);
        throw error;
    }
}

/**
 * Calculate transaction fee.
 */
export function calculateTxFee(psbt: bitcoin.Psbt, feeRate: number): number {
    // Use the function from ordinalsplus
    return calculateTxFeeFn(psbt, feeRate);
} 