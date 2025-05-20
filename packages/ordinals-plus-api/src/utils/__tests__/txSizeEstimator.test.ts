import {
  BASE_TX_OVERHEAD_VBYTES,
  P2TR_OUTPUT_VBYTES,
  P2TR_KEY_PATH_INPUT_VBYTES,
  estimateInscriptionEnvelopeVBytes,
  estimateP2TRScriptPathInputVBytes,
  estimateTxVBytes,
} from '../txSizeEstimator';

describe('txSizeEstimator', () => {
  describe('Constants', () => {
    it('BASE_TX_OVERHEAD_VBYTES should be correct', () => {
      expect(BASE_TX_OVERHEAD_VBYTES).toBe(10.5);
    });

    it('P2TR_OUTPUT_VBYTES should be correct', () => {
      expect(P2TR_OUTPUT_VBYTES).toBe(31);
    });

    it('P2TR_KEY_PATH_INPUT_VBYTES should be correct', () => {
      expect(P2TR_KEY_PATH_INPUT_VBYTES).toBe(58);
    });
  });

  describe('estimateInscriptionEnvelopeVBytes', () => {
    it('should estimate vbytes for a simple text inscription', () => {
      const contentType = 'text/plain';
      const content = 'Hello, world!';
      const contentByteLength = Buffer.from(content, 'utf-8').length; // 13 bytes
      const metadataByteLength = 0; // No metadata

      // Expected script construction for calculation:
      // OP_FALSE OP_IF OP_ENDIF : 3 bytes
      // OP_PUSH "ord" (3 bytes data): 1 (OP_PUSHBYTES_3) + 3 = 4 bytes
      // OP_PUSH <0x01> (content type tag, 1 byte data): 1 (OP_PUSHBYTES_1) + 1 = 2 bytes
      // OP_PUSH "text/plain" (10 bytes data): 1 (OP_PUSHBYTES_10) + 10 = 11 bytes
      // OP_0 (separator for body): 1 byte
      // OP_PUSH "Hello, world!" (13 bytes data): 1 (OP_PUSHBYTES_13) + 13 = 14 bytes
      // Total: 3 + 4 + 2 + 11 + 1 + 14 = 35 bytes

      const expectedScriptLength = 
        3 + // OP_FALSE, OP_IF, OP_ENDIF
        (1 + Buffer.from('ord', 'utf-8').length) + // Push "ord"
        (1 + Buffer.from([0x01]).length) + // Push content type tag
        (1 + Buffer.from(contentType, 'utf-8').length) + // Push content type value
        1 + // OP_0 separator
        (1 + contentByteLength); // Push content body

      const result = estimateInscriptionEnvelopeVBytes(contentType, contentByteLength, metadataByteLength);
      expect(result).toBe(expectedScriptLength);
      expect(result).toBe(35); 
    });

    it('should estimate vbytes with metadata and metaprotocol and chunked content', () => {
      const contentType = 'image/png'; // 9 bytes
      const contentByteLength = 1000; 
      const metadataCbor = Buffer.from(JSON.stringify({ "key": "value" })); // {"key":"value"} -> 15 bytes
      const metadataByteLength = metadataCbor.length; // 15 bytes
      const metaprotocol = 'mp_test'; // 7 bytes

      // Helper to mimic internal estimatePushDataSize for test calculation clarity
      const testEstimatePushDataSize = (len: number) => {
        if (len === 0) return 1; // OP_0
        if (len <= 75) return 1 + len;
        if (len <= 255) return 2 + len;
        if (len <= 520) return 3 + len; // Max push in tapscript
        // Should not happen for single push in tapscript context for this helper
        if (len <= 65535) return 3 + len; 
        return 5 + len; // PUSHDATA4, not really applicable for single tapscript pushes
      };

      // Helper to mimic internal calculateScriptPushChunksVBytes
      const testCalculateScriptPushChunksVBytes = (dataLen: number) => {
        if (dataLen === 0) return 1; // OP_0
        let totalBytes = 0;
        let remaining = dataLen;
        const MAX_CHUNK = 520;
        while (remaining > 0) {
          const chunkSize = Math.min(remaining, MAX_CHUNK);
          totalBytes += testEstimatePushDataSize(chunkSize);
          remaining -= chunkSize;
        }
        return totalBytes;
      };

      let expected = 3; // OP_FALSE, OP_IF, OP_ENDIF
      expected += testEstimatePushDataSize(Buffer.from('ord', 'utf-8').length); // "ord"
      
      // Metaprotocol
      expected += testEstimatePushDataSize(Buffer.from([0x07]).length); // tag "7"
      expected += testEstimatePushDataSize(Buffer.from(metaprotocol, 'utf-8').length); // metaprotocol value

      // Content Type
      expected += testEstimatePushDataSize(Buffer.from([0x01]).length); // tag "1"
      expected += testEstimatePushDataSize(Buffer.from(contentType, 'utf-8').length); // content type value

      // Metadata
      expected += testEstimatePushDataSize(Buffer.from([0x05]).length); // tag "5"
      expected += testCalculateScriptPushChunksVBytes(metadataByteLength); // metadata value (15 bytes -> 1+15=16)
      
      expected += 1; // OP_0 separator
      
      expected += testCalculateScriptPushChunksVBytes(contentByteLength); // content (1000 bytes -> (3+520) + (3+480) = 523+483 = 1006)

      const result = estimateInscriptionEnvelopeVBytes(contentType, contentByteLength, metadataByteLength, metaprotocol);
      expect(result).toBe(expected);
      
      // Manual breakdown for this specific case:
      // OP_FALSE, OP_IF, OP_ENDIF: 3
      // PUSH "ord" (3 bytes): 1+3 = 4
      // PUSH <0x07> (1 byte): 1+1 = 2
      // PUSH "mp_test" (7 bytes): 1+7 = 8
      // PUSH <0x01> (1 byte): 1+1 = 2
      // PUSH "image/png" (9 bytes): 1+9 = 10
      // PUSH <0x05> (1 byte): 1+1 = 2
      // PUSH metadata (15 bytes): 1+15 = 16
      // OP_0 separator: 1
      // PUSH content chunk 1 (520 bytes): 3+520 = 523
      // PUSH content chunk 2 (480 bytes): 3+480 = 483
      // Total = 3+4+2+8+2+10+2+16+1+523+483 = 1054
      expect(result).toBe(1054);
    });
  });

  describe('estimateP2TRScriptPathInputVBytes', () => {
    it('should estimate vbytes for a script path spend', () => {
      const numOtherWitnessElementsVBytes = 20; // e.g., signature vbytes
      const envelopeScriptLength = 100; // Example script length
      const controlBlockLeafDepth = 0;

      // NON_WITNESS_BYTES (41) + WITNESS_COUNT_BYTES (1) + 
      // control_block_vbytes (ceil((1+32)/4) = ceil(33/4) = 9) +
      // envelope_script_vbytes (ceil(100/4) = 25) +
      // other_elements_vbytes (20)
      // Total = 41 + 1 + 9 + 25 + 20 = 96
      const expected = (36 + 4 + 1) + 1 + Math.ceil((1 + 32 + 0*32)/4) + Math.ceil(envelopeScriptLength/4) + numOtherWitnessElementsVBytes;
      const result = estimateP2TRScriptPathInputVBytes(numOtherWitnessElementsVBytes, envelopeScriptLength, controlBlockLeafDepth);
      expect(result).toBe(expected);
      expect(result).toBe(96);
    });
  });

  describe('estimateTxVBytes', () => {
    it('should estimate for key path inputs and P2TR outputs only', () => {
      const numKeyPathInputs = 2;
      const numP2TROutputs = 2;
      // Expected: BASE (10.5) + Inputs (2*58=116) + Outputs (2*31=62)
      // Total = 10.5 + 116 + 62 = 188.5 => ceil = 189
      const expected = Math.ceil(BASE_TX_OVERHEAD_VBYTES + numKeyPathInputs * P2TR_KEY_PATH_INPUT_VBYTES + numP2TROutputs * P2TR_OUTPUT_VBYTES);
      const result = estimateTxVBytes(numKeyPathInputs, numP2TROutputs);
      expect(result).toBe(expected);
      expect(result).toBe(189);
    });

    it('should estimate with inscription details', () => {
      const numKeyPathInputs = 1; // 1 funding input
      const numP2TROutputs = 2;   // 1 recipient, 1 change
      const inscriptionDetails = {
        contentType: 'text/plain',
        contentByteLength: 50,
        metadataByteLength: 0,
        numOtherInscriptionWitnessVBytes: 20, // e.g. signature for script path
      };

      const envelopeScriptLength = estimateInscriptionEnvelopeVBytes(
        inscriptionDetails.contentType,
        inscriptionDetails.contentByteLength,
        inscriptionDetails.metadataByteLength
      );
      const inscriptionInputVBytes = estimateP2TRScriptPathInputVBytes(
        inscriptionDetails.numOtherInscriptionWitnessVBytes,
        envelopeScriptLength,
        0
      );

      // Expected: BASE (10.5) + KeyPathInput (1*58=58) + InscriptionInputVBytes + Outputs (2*31=62)
      const expected = Math.ceil(
        BASE_TX_OVERHEAD_VBYTES + 
        numKeyPathInputs * P2TR_KEY_PATH_INPUT_VBYTES + 
        inscriptionInputVBytes + 
        numP2TROutputs * P2TR_OUTPUT_VBYTES
      );
      const result = estimateTxVBytes(numKeyPathInputs, numP2TROutputs, inscriptionDetails);
      expect(result).toBe(expected);
    });
  });
}); 