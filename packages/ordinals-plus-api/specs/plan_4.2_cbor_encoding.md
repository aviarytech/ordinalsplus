## Detailed Implementation Plan for Subtask 4.2: Implement CBOR Metadata Encoding

**Associated Taskmaster Subtask ID:** 4.2

**Date Logged:** $(date +%Y-%m-%d)

**Target Files:**
*   Utility: `packages/ordinals-plus-api/src/utils/metadataEncoder.ts` (to be created)
*   Tests: `packages/ordinals-plus-api/src/utils/__tests__/metadataEncoder.test.ts` (to be created)
*   Documentation: Update `packages/ordinals-plus-api/specs/transaction_structure_spec.md` (existing)

---

### A. Define Internal CBOR Structure for Metadata

1.  **Decision:** The CBOR payload for Ordinals Plus metadata will be a map (object) with two keys:
    *   `didDocument`: The value will be the DID Document (typically a JSON object).
    *   `verifiableCredential`: The value will be the Verifiable Credential (can be a JSON object or a JWT string).
2.  **Example JavaScript object to be encoded:**
    ```javascript
    {
      didDocument: { /* ... DID Document JSON structure ... */ },
      verifiableCredential: { /* ... VC JSON structure or JWT string ... */ }
    }
    ```
3.  **Action:** This structure needs to be formally documented. This will be done by adding a new subsection to the existing `transaction_structure_spec.md` file, specifically detailing this internal CBOR map format under a heading like "Internal Structure of CBOR Metadata Payload".

### B. Setup CBOR Library

1.  **Verification:** Check `package.json` to ensure the `cbor` npm package (or a similar well-vetted CBOR implementation for TypeScript/JavaScript) is listed as a dependency.
    *   If not present, add it: `npm install cbor` (or `yarn add cbor` / `pnpm add cbor` depending on the project's package manager).
2.  **API Familiarization:** Review the documentation for the chosen CBOR library, focusing on its `encode` function (and `decode` for testing purposes). Understand how it handles JavaScript objects, strings, numbers, and buffers.

### C. Implement Encoding Utility Function(s)

1.  **File Creation:** Create `packages/ordinals-plus-api/src/utils/metadataEncoder.ts`.
2.  **Function Signature:**
    ```typescript
    import { encode } from 'cbor'; // Or the equivalent from the chosen library

    interface OrdinalsPlusMetadataInput {
      didDocument: object; // Assuming a parsed JSON object for the DID doc
      verifiableCredential: object | string; // Parsed JSON or JWT string for VC
    }

    /**
     * Encodes the Ordinals Plus metadata (DID Document and Verifiable Credential)
     * into a CBOR-formatted Buffer.
     *
     * @param metadata - An object containing the didDocument and verifiableCredential.
     * @returns A Buffer containing the CBOR-encoded metadata.
     * @throws Error if encoding fails.
     */
    export function encodeOrdinalsPlusMetadata(metadata: OrdinalsPlusMetadataInput): Buffer {
      const payload = {
        didDocument: metadata.didDocument,
        verifiableCredential: metadata.verifiableCredential,
      };
      try {
        return encode(payload);
      } catch (error) {
        // Log the error or handle it more gracefully
        console.error('Failed to encode metadata to CBOR:', error);
        throw new Error('CBOR encoding failed.');
      }
    }
    ```
3.  **Type Definitions:** Consider adding more specific TypeScript interfaces for `didDocument` and `verifiableCredential` if common structures are known, to improve type safety. For now, `object` is a general placeholder.

### D. Size Validation & Chunking (Primarily Documentation and Helper Function)

1.  **Helper for Size Estimation (in `metadataEncoder.ts`):**
    ```typescript
    /**
     * Estimates the size of the CBOR-encoded metadata.
     *
     * @param metadata - The metadata to be encoded.
     * @returns The size in bytes of the resulting CBOR buffer.
     */
    export function getEncodedMetadataSize(metadata: OrdinalsPlusMetadataInput): number {
      return encodeOrdinalsPlusMetadata(metadata).length;
    }
    ```
2.  **Documentation Note:** Emphasize in `transaction_structure_spec.md` (and potentially in JSDoc for `encodeOrdinalsPlusMetadata`) that the service responsible for constructing the Bitcoin transaction script (e.g., `inscriptionService.ts`) must take the Buffer returned by `encodeOrdinalsPlusMetadata` and, if its length exceeds 520 bytes, split it into multiple chunks, each pushed via a separate `OP_PUSH` opcode.

### E. Implement Unit Tests

1.  **File Creation:** Create `packages/ordinals-plus-api/src/utils/__tests__/metadataEncoder.test.ts`.
2.  **Test Suite Structure:**
    ```typescript
    import { encodeOrdinalsPlusMetadata, getEncodedMetadataSize } from '../metadataEncoder';
    import { decodeFirst } from 'cbor'; // For decoding and verification

    describe('Metadata CBOR Encoding', () => {
      const mockDidDoc = { id: 'did:example:123', verificationMethod: [] };
      const mockVcJson = { '@context': 'https://www.w3.org/2018/credentials/v1', id: 'urn:uuid:xyz', type: ['VerifiableCredential'] };
      const mockVcJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

      it('should correctly encode a DID document and a JSON VC', () => {
        const metadata = { didDocument: mockDidDoc, verifiableCredential: mockVcJson };
        const encoded = encodeOrdinalsPlusMetadata(metadata);
        expect(encoded).toBeInstanceOf(Buffer);
        const decoded = await decodeFirst(encoded); // cbor.decodeFirst might be async or sync
        expect(decoded).toEqual(payload); // payload is { didDocument: mockDidDoc, verifiableCredential: mockVcJson }
      });

      it('should correctly encode a DID document and a JWT VC', () => {
        const metadata = { didDocument: mockDidDoc, verifiableCredential: mockVcJwt };
        const encoded = encodeOrdinalsPlusMetadata(metadata);
        expect(encoded).toBeInstanceOf(Buffer);
        const decoded = await decodeFirst(encoded);
        expect(decoded).toEqual(payload); // payload is { didDocument: mockDidDoc, verifiableCredential: mockVcJwt }
      });

      it('should return a buffer of the correct size via getEncodedMetadataSize', () => {
        const metadata = { didDocument: mockDidDoc, verifiableCredential: mockVcJson };
        const directEncoding = encodeOrdinalsPlusMetadata(metadata);
        expect(getEncodedMetadataSize(metadata)).toEqual(directEncoding.length);
      });
      
      it('should handle empty inputs gracefully (e.g., throw or return defined empty CBOR)', () => {
        // Define expected behavior for empty/null didDoc or vc
        // Example: expect(() => encodeOrdinalsPlusMetadata({ didDocument: {}, verifiableCredential: '' })).toThrow();
      });

      // Add more tests: complex nested objects, different data types within objects etc.
    });
    ```
3.  Ensure tests cover validation of the decoded content against the original input.

### F. Document Encoding Process and Format Specifications

1.  **Update `transaction_structure_spec.md`:**
    *   Add a new dedicated subsection under "4. Data Encoding" titled something like "4.1. Internal Structure of CBOR Metadata Payload (`metadata` field - tag 5)".
    *   In this subsection, explicitly define the map structure: `{ didDocument: <DID_JSON_object>, verifiableCredential: <VC_JSON_object_or_JWT_string> }`.
    *   Provide a brief example.
    *   Reference the `encodeOrdinalsPlusMetadata` utility function in `metadataEncoder.ts` as the canonical way to produce this CBOR payload.
    *   Reiterate the need for chunking the output of this function if > 520 bytes when building the transaction script.

---

This plan provides a clear path for implementing and documenting the CBOR encoding for Ordinals Plus metadata.

---

## Reflection on Subtask 4.2 (Post-Implementation)

**Date Logged:** $(date +%Y-%m-%d)

*   **Scalability:**
    *   The `encodeOrdinalsPlusMetadata` function itself is efficient, relying on the `cbor` library.
    *   The primary scalability constraint is the on-chain size of the CBOR payload, which is a broader design consideration for Ordinals Plus.
    *   `getEncodedMetadataSize` allows services to be proactive about size.

*   **Maintainability:**
    *   Dedicated utility file (`metadataEncoder.ts`) with a clear interface (`OrdinalsPlusMetadataInput`) and JSDoc enhances maintainability.
    *   Input validation in `encodeOrdinalsPlusMetadata` adds robustness.
    *   Comprehensive unit tests ensure changes can be verified.
    *   The simple internal CBOR structure (`{ didDocument, verifiableCredential }`) is easy to understand.

**Potential Improvements / Next Steps Noted:**

1.  **More Specific Types:** Consider defining more specific TypeScript interfaces (e.g., `DidDocument`, `VerifiableCredentialJson`, `VerifiableCredentialJwt`) for `OrdinalsPlusMetadataInput` fields if not already available, to improve type safety and clarity of the function's contract.
2.  **Error Handling:** Depending on the project's overall error strategy, introduce custom error classes (e.g., `CborEncodingError`) for more granular error catching by consumers of the utility.
3.  **CBOR Decoding in Tests:** Confirmed that `cbor.decodeFirst` is synchronous; `async/await` in the test stubs for decoding can be removed. 