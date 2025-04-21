import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';

bitcoin.initEccLib(ecc);

// Use the standard BIP341 NUMS point H's x-coordinate as the internal key
// when no specific key is needed for script path spending construction.
// H = lift_x(0x50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0)
const NUMS_H_X_ONLY_PUBKEY = Buffer.from(
    '50929b74c1a04954b78b4b6035e97a5e078a5a0f28ec96d547bfee9ace803ac0',
    'hex'
);

// More realistic estimates for Taproot transaction components (vBytes)
// See: https://bitcoinops.org/en/tools/calc-size/
const BASE_TX_SIZE = 10.5; // Base transaction overhead
const P2TR_INPUT_SIZE = 57.5; // P2TR key path spend input size
const P2TR_OUTPUT_SIZE = 43; // P2TR output size

/**
 * Prepares the taproot output script for an Ordinal inscription and estimates reveal fee.
 *
 * @param contentType The MIME type of the content.
 * @param content The content to inscribe (string or Buffer).
 * @param feeRate The desired fee rate in satoshis per virtual byte (sats/vB).
 * @returns An object containing the hex-encoded inscription script and estimated reveal fee.
 * @throws Error if inputs are invalid.
 */
export function prepareInscriptionEnvelope(contentType: string, content: string | Buffer, feeRate: number): { inscriptionScript: Buffer, revealFee: number, estimatedRevealVBytes: number } {
    if (!contentType || typeof contentType !== 'string') {
        throw new Error('Invalid contentType: Must be a non-empty string.');
    }
    if (content === null || content === undefined || content === '') {
        throw new Error('Invalid content: Must not be empty.');
    }
    if (typeof feeRate !== 'number' || feeRate <= 0) {
        throw new Error('Invalid feeRate: Must be a positive number.');
    }

    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');

    // Construct the inscription script (witness script for reveal)
    const inscriptionScript = bitcoin.script.compile([
        bitcoin.opcodes.OP_FALSE,
        bitcoin.opcodes.OP_IF,
        Buffer.from('ord', 'utf8'),
        Buffer.from([1]),
        Buffer.from(contentType, 'utf8'),
        Buffer.from([0]),
        contentBuffer,
        bitcoin.opcodes.OP_ENDIF,
    ]);

    const scriptTree = { output: inscriptionScript }; // The actual inscription script forms the tree

    // Construct the P2TR payment using the inscription script tree
    const p2tr = bitcoin.payments.p2tr({
        internalPubkey: NUMS_H_X_ONLY_PUBKEY,
        scriptTree,
        network: bitcoin.networks.bitcoin, // Assume mainnet for fee calculation, adjust if needed
        // We need redeem info for the witness calculation used below
        redeem: { output: inscriptionScript, network: bitcoin.networks.bitcoin }
    });

    if (!p2tr.output || !p2tr.witness || !p2tr.redeem) {
        throw new Error('Failed to construct P2TR output script or witness data.');
    }
    const commitScriptPubKey = p2tr.output; // ScriptPubKey for the commit output
    const controlBlock = p2tr.witness[p2tr.witness.length - 1]; // Control block for reveal witness

    // Estimate Reveal Transaction Size
    // Input: P2TR script path spend (uses inscription script + control block)
    const revealInputSize = BASE_TX_SIZE + // Input base size
                            1 + // Varint for witness items count (1)
                            (1 + controlBlock.length) + // Control block with length prefix
                            (1 + inscriptionScript.length); // Inscription script with length prefix
    
    // Output: Standard P2TR output (e.g., back to user)
    const revealOutputSize = P2TR_OUTPUT_SIZE;

    const estimatedRevealVBytes = Math.ceil((revealInputSize + revealOutputSize) / 4); // Witness data gets discount
    
    // Calculate Fee
    const revealFee = Math.ceil(estimatedRevealVBytes * feeRate);

    return {
        inscriptionScript: commitScriptPubKey, // Return the scriptPubKey for commit tx output
        revealFee, // Return the calculated reveal fee
        estimatedRevealVBytes // Also return the estimated size for reference/debugging
    };
}
