// Service for constructing inscription PSBTs
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import type { PsbtResponse, GenericInscriptionRequest, DidInscriptionRequest } from '../types';
import type { Payment } from 'bitcoinjs-lib'; // Only import Payment

// Initialize factories
bitcoin.initEccLib(ecc);
const ECPair = ECPairFactory(ecc);

// TODO: Make network, fees, and dummy UTXO values configurable via environment variables
const network = bitcoin.networks.testnet;
const DUMMY_UTXO_VALUE = 10000; // Sats, Must be > dust limit + inscription cost estimate
const MIN_RELAY_FEE = 1000; // Minimum relay fee in sats

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
 */
function estimateRevealTxVsize(numInputs: number, numOutputs: number): number {
    const baseVsize = 11; 
    const inputVsize = 68 * numInputs; 
    const outputVsize = 43 * numOutputs; 
    return baseVsize + inputVsize + outputVsize; 
}

const POSTAGE_VALUE = 1000; // Sats for the inscription output value
const DUMMY_TXID = '0000000000000000000000000000000000000000000000000000000000000000';
const DUMMY_VOUT = 0;

/**
 * Constructs the reveal transaction PSBT for a generic inscription or linked resource.
 */
export async function constructGenericPsbt(request: GenericInscriptionRequest): Promise<PsbtResponse> {
    console.log('[constructGenericPsbt] Starting...', request);
    try {
        // 1. Decode Base64 Content
        let contentBuffer: Buffer;
        try {
            contentBuffer = Buffer.from(request.contentBase64, 'base64');
            console.log('[constructGenericPsbt] Step 1: Decoded Base64 content', { length: contentBuffer.length });
        } catch (e) {
            console.error('[constructGenericPsbt] Step 1 Failed: Invalid Base64', e);
            throw new Error('Invalid Base64 content string');
        }

        // TODO: Handle parentInscriptionId if provided in request (needs modification to InscriptionData)
        const parentInscriptionId: string | undefined = undefined; 

        // 2. Generate script key pair (internal key for Taproot)
        const scriptKeyPair = ECPair.makeRandom({ network });
        const scriptPubkey = scriptKeyPair.publicKey; // Full pubkey (with prefix)
        const internalPubKey = scriptPubkey.subarray(1, 33); // x-only pubkey
        const revealSignerPrivateKeyWif = scriptKeyPair.toWIF(); // Get the private key in WIF format
        console.log('[constructGenericPsbt] Step 2: Generated script key pair and WIF');

        // 3. Prepare inscription data structure
        const inscriptionData: InscriptionData = {
            contentType: Buffer.from(request.contentType),
            content: contentBuffer,
            parentInscriptionId: parentInscriptionId, 
            // metadata: undefined // Metadata removed from GenericInscriptionRequest
        };
        console.log('[constructGenericPsbt] Step 3: Prepared inscription data');

        // 4. Create the inscription scripts (commit output, redeem script, control block)
        console.log('[constructGenericPsbt] Step 4: Calling createInscriptionScripts...');
        const scripts = createInscriptionScripts(Buffer.from(scriptPubkey), inscriptionData);
        console.log('[constructGenericPsbt] Step 4: Scripts created', { address: scripts.address });
        
        // 5. Estimate Reveal Transaction Fee
        const revealFee = estimateRevealTxVsize(1, 1) * request.feeRate; // 1 input, 1 output
        console.log('[constructGenericPsbt] Step 5: Estimated reveal fee', { revealFee });

        // 6. Calculate Commit Transaction Output Value
        const commitTxOutputValue = POSTAGE_VALUE + revealFee;
        console.log('[constructGenericPsbt] Step 6: Calculated commit output value', { commitTxOutputValue });

        // 7. Construct the Reveal Transaction PSBT
        console.log('[constructGenericPsbt] Step 7: Constructing reveal PSBT...');
        const psbt = new bitcoin.Psbt({ network });

        // Add the input spending the commit transaction output
        psbt.addInput({
            hash: DUMMY_TXID, // Placeholder: Must be replaced with actual commit txid
            index: DUMMY_VOUT, // Placeholder: Must be replaced with actual commit output index
            witnessUtxo: { 
                script: scripts.output, // The P2TR scriptPubKey from the commit tx
                value: commitTxOutputValue // Value needed in the commit output
            },
            tapInternalKey: Buffer.from(internalPubKey), // Provide the internal key as Buffer
            tapLeafScript: [
                { 
                    controlBlock: scripts.controlBlock, 
                    script: scripts.inscriptionScript, 
                    leafVersion: scripts.leafVersion 
                }
            ]
        });
        console.log('[constructGenericPsbt] Step 7a: Added reveal input');

        // Add the output sending the inscribed sat to the recipient
        psbt.addOutput({
            address: request.recipientAddress,
            value: POSTAGE_VALUE
        });
        console.log('[constructGenericPsbt] Step 7b: Added reveal output');

        // 8. Convert PSBT to Base64
        const psbtBase64 = psbt.toBase64();
        console.log('[constructGenericPsbt] Step 8: Converted PSBT to Base64');

        // 9. Return the response
        const response: PsbtResponse = {
            psbtBase64,
            commitTxOutputValue, // Include value needed for commit tx output
            revealFee, // Include estimated reveal fee
            revealSignerPrivateKeyWif // Include the private key needed to sign the reveal input
        };
        
        // --- Add Log for Final Calculation Check --- 
        console.log('[constructGenericPsbt] Final Calculation Check:', {
            postage: POSTAGE_VALUE, // Log the constant used
            estimatedRevealFee: revealFee,
            calculatedCommitOutputValue: commitTxOutputValue,
            returnedResponse: response // Log the whole response object being returned
        });
        // --- End Log ---

        console.log('[constructGenericPsbt] Completed successfully.');
        return response;

    } catch (error) {
        console.error('[constructGenericPsbt] Error caught:', error);
        // Log the specific error message
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[constructGenericPsbt] Error Message: ${errorMessage}`);
        // Optional: Log stack trace if available
        if (error instanceof Error && error.stack) {
            console.error(`[constructGenericPsbt] Stack Trace: ${error.stack}`);
        }
        throw new Error(`Failed to construct generic/resource PSBT: ${errorMessage}`);
    }
}

// --- constructDidPsbt needs implementation based on spec ---
export async function constructDidPsbt(request: DidInscriptionRequest): Promise<PsbtResponse> {
    console.warn('constructDidPsbt: Using placeholder content - Needs spec details for contentType and content');
    
    // TODO: Determine the exact content type and content for a DID marker inscription based on did:btco spec
    const didContentType = 'text/plain'; // Placeholder Content Type
    const didContent = `did:btco:${request.recipientAddress}`; // Placeholder Content: Simple text marker using recipient address

    const genericRequest: GenericInscriptionRequest = {
        contentType: didContentType,
        contentBase64: Buffer.from(didContent).toString('base64'), // Use contentBase64 and encode placeholder content
        recipientAddress: request.recipientAddress, // Use recipient address from request
        feeRate: request.feeRate
        // No metadata or parent for initial DID creation usually
    };
    
    console.log('[constructDidPsbt] Calling constructGenericPsbt with derived request:', genericRequest);

    // Reuse the generic construction logic
    return constructGenericPsbt(genericRequest);
} 