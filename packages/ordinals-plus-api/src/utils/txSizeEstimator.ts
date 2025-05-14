// packages/ordinals-plus-api/src/utils/txSizeEstimator.ts

/**
 * Base transaction overhead (version, locktime, input count, output count markers).
 * Does not include the inputs and outputs themselves.
 */
export const BASE_TX_OVERHEAD_VBYTES = 10.5; // Common estimate, can be 10 or 11 depending on segwit/non-segwit markers if any input is non-segwit.

/**
 * Estimated virtual bytes for a standard P2TR (Taproot) output.
 * OP_1 OP_PUSH32 <32_byte_pubkey> (34 bytes) + value (8 bytes) = 42 bytes.
 * bitcoinjs-lib often calculates fees based on ~31vBytes for the script part.
 * Using a common estimate that aligns with fee calculation focus.
 */
export const P2TR_OUTPUT_VBYTES = 31;

/**
 * Estimated virtual bytes for a P2TR (Taproot) input spent via key path.
 * Includes prevout, sequence, empty scriptSig, and witness (signature).
 * (36 prevout + 4 sequence + 1 scriptSigLen + 0 scriptSig + 1 witnessItemsCount + 1 witnessSigLen + 64 signature) / 4 (for witness part) + non_witness_part
 * More simply: Non-witness: 36+4+1 = 41 bytes. Witness: (1+64) = 65 WU. Total = 41 + 65/4 = 41 + 16.25 = 57.25 vBytes.
 * Rounded to 58 for simplicity and slight buffer.
 */
export const P2TR_KEY_PATH_INPUT_VBYTES = 58;

/**
 * Estimates the virtual size of the Ordinals inscription envelope part of the witness.
 * This does NOT include other witness elements like signature or control block for a script path spend.
 * It only estimates the size of the OP_FALSE, OP_IF, OP_PUSH "ord", field pushes, body pushes, OP_ENDIF.
 *
 * @param contentType - The MIME type string for the content.
 * @param contentByteLength - The byte length of the actual content.
 * @param metadataByteLength - The byte length of the CBOR-encoded metadata.
 * @param metaprotocol - Optional metaprotocol identifier string.
 * @returns Estimated virtual bytes for the envelope script pushes.
 */
export function estimateInscriptionEnvelopeVBytes(
  contentType: string,
  contentByteLength: number,
  metadataByteLength: number,
  metaprotocol?: string
): number {
  let scriptLength = 0;
  // OP_FALSE, OP_IF, OP_ENDIF
  scriptLength += 1 + 1 + 1; // 3 bytes

  // OP_PUSH "ord"
  scriptLength += estimatePushDataSize(Buffer.from('ord', 'utf-8').length);

  // Metaprotocol field (optional) - Tag "7"
  if (metaprotocol && metaprotocol.length > 0) {
    scriptLength += estimatePushDataSize(Buffer.from([0x07]).length); // Push for field key (tag 7)
    scriptLength += estimatePushDataSize(Buffer.from(metaprotocol, 'utf-8').length); // Push for value
  }

  // Content Type field - Tag "1"
  scriptLength += estimatePushDataSize(Buffer.from([0x01]).length); // Push for field key (tag 1)
  scriptLength += estimatePushDataSize(Buffer.from(contentType, 'utf-8').length); // Push for value

  // Metadata field - Tag "5"
  // Only add if metadataByteLength > 0, as pushing an empty buffer for metadata is not typical unless explicitly required
  if (metadataByteLength > 0) {
    scriptLength += estimatePushDataSize(Buffer.from([0x05]).length); // Push for field key (tag 5)
    scriptLength += calculateScriptPushChunksVBytes(metadataByteLength); // Pushes for CBOR metadata
  }

  // Separator for Content Body - OP_0 (pushes an empty buffer, which is 1 byte: OP_0)
  scriptLength += 1; 

  // Actual Inscription Content (only if contentByteLength > 0)
  // If contentByteLength is 0, it means no body, so no pushes for it.
  // Pushing an empty buffer via calculateScriptPushChunksVBytes(0) would result in 1 byte (OP_0)
  // which might be intended if an empty body is distinct from no body part.
  // For now, assume if contentByteLength is 0, this part is skipped.
  // The spec implies body is always present, even if empty. So OP_0 then OP_0 if empty body.
  // Let's follow `calculateScriptPushChunksVBytes` which returns 1 for dataLength 0.
  scriptLength += calculateScriptPushChunksVBytes(contentByteLength); // Pushes for content

  return scriptLength; // This is the total length of the script to be embedded in the witness.
                       // The vbyte contribution of this script part of the witness is scriptLength / 4.
}

/**
 * Calculates the number of script bytes needed to push data of a given length,
 * accounting for OP_PUSHDATA opcodes.
 * Data is chunked into max 520-byte segments.
 * @param dataLength The total length of the data to be pushed.
 * @returns The script size in bytes for all necessary OP_PUSH operations.
 */
function calculateScriptPushChunksVBytes(dataLength: number): number {
  if (dataLength === 0) return 1; // For OP_0 (pushes an empty buffer)
  let bytes = 0;
  let remaining = dataLength;
  const MAX_PUSH_SIZE = 520;
  while (remaining > 0) {
    const chunkSize = Math.min(remaining, MAX_PUSH_SIZE);
    bytes += estimatePushDataSize(chunkSize);
    remaining -= chunkSize;
  }
  return bytes;
}

/**
 * Estimates the size of a single OP_PUSHDATA opcode prefix for a given data chunk size.
 * @param dataChunkLength Length of the data chunk (must be <= 520 for valid single push in Tapscript).
 * @returns Number of bytes for the OP_PUSHDATA prefix + data itself.
 */
function estimatePushDataSize(dataChunkLength: number): number {
  let prefixBytes = 0;
  if (dataChunkLength === 0) {
    // This case should ideally be handled by OP_0 directly, not by pushing a zero-length buffer via OP_PUSHBYTES_0
    // However, bitcoin-ts/ord library uses OP_PUSHDATA1 0 <empty> for empty buffer push.
    // Standard interpretation: OP_0 (0x00) pushes an empty array.
    // OP_PUSHBYTES_0 (0x4c 0x00) also pushes an empty array but takes 2 bytes.
    // Let's assume OP_0 for an empty push, costing 1 byte.
    // This function is for data CHUNKS. An empty chunk pushed via OP_0 is 1 byte.
    // If calculateScriptPushChunksVBytes calls this with 0, it means it's trying to push a 0-length chunk,
    // which implies an OP_0.
    return 1; // Represents OP_0 for pushing an empty buffer/value
  } else if (dataChunkLength <= 75) {
    prefixBytes = 1; // OP_PUSHBYTES_N
  } else if (dataChunkLength <= 255) {
    prefixBytes = 2; // OP_PUSHDATA1
  } else if (dataChunkLength <= 65535) {
    // Max 520 for tapscript, so this case is mostly theoretical for single pushes here
    prefixBytes = 3; // OP_PUSHDATA2
  } else {
    prefixBytes = 5; // OP_PUSHDATA4 (Not applicable for Tapscript single push limit of 520)
  }
  return prefixBytes + dataChunkLength;
}

/**
 * Estimates the virtual bytes for a P2TR (Taproot) input spent via script path.
 * This is a rough estimate and highly dependent on the control block and witness script contents.
 *
 * @param witnessScriptVBytes The virtual byte size of the witness script itself (e.g., from estimateInscriptionEnvelopeVBytes).
 * @param numControlBlockElements - Typically 1 (internal key) + N (tapleaf hashes in path, 0 for a single leaf).
 *                                  A single leaf script has a control block of (1 + 32) bytes.
 * @returns Estimated virtual bytes.
 */
export function estimateP2TRScriptPathInputVBytes(
  numOtherWitnessElements: number, // e.g., vbytes of signature, other data needed by the script BEFORE the envelope
  envelopeScriptLength: number,    // Raw length of the envelope script (from estimateInscriptionEnvelopeVBytes)
  controlBlockLeafDepth = 0       // 0 for a single leaf script used directly
): number {
  const NON_WITNESS_BYTES = 36 + 4 + 1; // prevout + sequence + scriptSigLen (0)
  const WITNESS_COUNT_BYTES = 1; // For the witness stack item count itself

  // Control block: 1 (version/parity) + 32 (internal pubkey) + (depth * 32) for tapleaf hashes
  const controlBlockBytes = 1 + 32 + (controlBlockLeafDepth * 32);
  
  // Witness components:
  // 1. Control Block
  // 2. Inscription Script (envelopeScriptLength)
  // 3. Other elements (e.g., signature for CHECKSIG in the script)
  // Total witness stack items: 1 (control block) + 1 (script) + N (other elements, if pushed separately)
  // The envelopeScriptLength is the raw script. Its vbyte contribution is envelopeScriptLength / 4.
  // numOtherWitnessElements is assumed to be already in vbytes or represents count of other small items.
  // Let's assume numOtherWitnessElements is the vbyte sum of other witness items.

  const witnessVBytes = Math.ceil(controlBlockBytes / 4) +  // Control block vbytes
                        Math.ceil(envelopeScriptLength / 4) + // Inscription script vbytes
                        numOtherWitnessElements;              // Other witness elements (e.g. signature) vbytes

  // Total witness items count (for varint prefix before witness data)
  // This count affects the initial WITNESS_COUNT_BYTES if it becomes > 252
  // For now, assume it's small. This is a simplification.
  
  return NON_WITNESS_BYTES + WITNESS_COUNT_BYTES + witnessVBytes;
}


/**
 * A simplified overall transaction size estimator.
 * For more precise calculations, a library like bitcoinjs-lib should be used to build
 * a virtual transaction and get its virtualSize.
 *
 * @param numKeyPathInputs Number of P2TR key path spend inputs.
 * @param inscriptionDetails Optional details if an inscription input is present.
 * @param numOutputs Number of P2TR outputs.
 * @returns Estimated total transaction virtual bytes.
 */
export function estimateTxVBytes(
  numKeyPathInputs: number,
  numP2TROutputs: number,
  inscriptionDetails?: {
    contentType: string;
    contentByteLength: number;
    metadataByteLength: number;
    metaprotocol?: string;
    // numOtherInscriptionWitnessVBytes should be the vbytes of things like the signature for the script path spend
    numOtherInscriptionWitnessVBytes: number; 
  }
): number {
  let totalVBytes = BASE_TX_OVERHEAD_VBYTES;
  totalVBytes += numKeyPathInputs * P2TR_KEY_PATH_INPUT_VBYTES;
  totalVBytes += numP2TROutputs * P2TR_OUTPUT_VBYTES;

  if (inscriptionDetails) {
    const envelopeScriptLength = estimateInscriptionEnvelopeVBytes(
      inscriptionDetails.contentType,
      inscriptionDetails.contentByteLength,
      inscriptionDetails.metadataByteLength,
      inscriptionDetails.metaprotocol
    );
    
    // Estimate P2TR script path input size
    // Assuming 0 for controlBlockLeafDepth (single leaf)
    // numOtherInscriptionWitnessVBytes is for elements like the signature required by the CHECKSIG in the tapscript
    const inscriptionInputVBytes = estimateP2TRScriptPathInputVBytes(
      inscriptionDetails.numOtherInscriptionWitnessVBytes,
      envelopeScriptLength,
      0 // controlBlockLeafDepth
    );
    totalVBytes += inscriptionInputVBytes;
  }

  return Math.ceil(totalVBytes);
} 