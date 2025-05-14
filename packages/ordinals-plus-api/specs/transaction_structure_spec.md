# Ordinals Plus Inscription Transaction Structure Specification

## 1. Introduction

This document defines the Bitcoin transaction structure for **Ordinals Plus** inscriptions. The primary goal is to extend the standard Ordinals protocol to allow for the embedding of verifiable metadata, specifically a Decentralized Identifier (DID) Document and a Verifiable Credential (VC), directly within the inscription transaction. This metadata will be CBOR-encoded.

## 2. Goals

*   Embed a DID Document and a Verifiable Credential (VC), encoded in CBOR format, as part of the inscription.
*   Maintain compatibility with Bitcoin consensus rules.
*   Leverage the existing Ordinals protocol structure for discoverability and tooling compatibility where possible.
*   Clearly define how Ordinals Plus metadata is differentiated and parsed.
*   Optimize for transaction size and cost efficiency within Bitcoin's constraints.

## 3. Proposed Transaction Structure

Ordinals Plus inscriptions will be embedded within the witness data of a Bitcoin transaction, utilizing a Taproot script-path spend. This follows the commit/reveal scheme common to standard Ordinals.

The core of the inscription is an "envelope" using `OP_FALSE OP_IF ... OP_ENDIF` to store arbitrary data.

### 3.1. Envelope Structure

The witness script for an Ordinals Plus inscription will have the following structure:

```
<your_taproot_internal_key_pubkey> OP_CHECKSIG // Or other script satisfying the taproot output

// Ordinals Plus Envelope
OP_FALSE
OP_IF
  OP_PUSH "ord" // Standard Ordinals identifier

  // --- Optional: Ordinals Plus Metaprotocol Identifier ---
  // To explicitly distinguish Ordinals Plus inscriptions for dedicated indexers.
  // This uses the standard 'metaprotocol' field (tag 7).
  OP_PUSH 7                             // Tag for 'metaprotocol'
  OP_PUSH "ordplus/v0.1"                // Value: Ordinals Plus metaprotocol identifier (example)

  // --- Standard Content Type ---
  // Uses the standard 'content_type' field (tag 1).
  OP_PUSH 1                             // Tag for 'content_type'
  OP_PUSH "<MIME_TYPE_OF_CONTENT>"      // Value: e.g., "text/plain;charset=utf-8", "image/jpeg"

  // --- Ordinals Plus Metadata (DID Document + VC) ---
  // This is the core extension for Ordinals Plus.
  // It uses the standard 'metadata' field (tag 5) as defined in the Ordinals specification.
  // The value will be the CBOR-encoded byte string containing both the DID Document and the VC.
  OP_PUSH 5                             // Tag for 'metadata'
  OP_PUSH <CBOR_encoded_metadata_chunk_1>
  // If CBOR_encoded_metadata > 520 bytes, it will be split into multiple data pushes:
  // OP_PUSH <CBOR_encoded_metadata_chunk_2>
  // ...
  // OP_PUSH <CBOR_encoded_metadata_chunk_N>

  // --- Separator for Content Body ---
  // An empty data push (OP_0) indicates the end of protocol fields and the beginning of the content body.
  OP_0                                  // Tag for body (empty push)

  // --- Actual Inscription Content ---
  OP_PUSH <content_data_chunk_1>
  // If content_data > 520 bytes, it will be split into multiple data pushes:
  // OP_PUSH <content_data_chunk_2>
  // ...
  // OP_PUSH <content_data_chunk_N>
OP_ENDIF
```

**Key Points:**

*   **`OP_PUSH "ord"`**: Identifies the envelope as related to the Ordinals protocol.
*   **Metaprotocol Field (Tag 7, Optional but Recommended):** Pushing a unique string like `"ordplus/v0.1"` allows Ordinals Plus aware indexers to easily identify and specifically process these inscriptions. If this field is absent, indexers would rely on the presence and format of the metadata in field 5.
*   **Content Type Field (Tag 1):** Standard MIME type for the main inscription content.
*   **Metadata Field (Tag 5):** This field will contain the CBOR-encoded binary data. The CBOR data should be structured to contain both the DID Document and the Verifiable Credential. The exact internal structure of this CBOR object needs to be defined in a separate specification (e.g., how to distinguish the DID from the VC within the CBOR).
*   **Body Separator (Tag 0 / `OP_0`):** An `OP_0` (which pushes an empty byte string) signifies that all preceding data pushes were partfields, and subsequent data pushes constitute the main inscription content.
*   **Data Pushes:** Each `OP_PUSH <data>` must not exceed 520 bytes. Larger data (for metadata or content) must be split across multiple consecutive `OP_PUSH` operations.

### 3.2. Input/Output Configuration

*   **Commit Transaction:** Creates a P2TR (Pay-to-Taproot) output that commits to the script detailed above.
*   **Reveal Transaction:** Spends the P2TR output from the commit transaction. The witness of this spending input will contain the script detailed in 3.1.
    *   The inscription is made on the first satoshi of the first input of the reveal transaction by default (unless a `pointer` field is used, which is not planned for the initial Ordinals Plus spec).

## 4. Data Encoding

*   **Metadata (DID Document + VC):** Encoded using Concise Binary Object Representation (CBOR). This results in a single byte string that is then pushed into the `metadata` field (tag 5).
*   **Content Type:** UTF-8 string, as per MIME standards.
*   **Metaprotocol Identifier:** UTF-8 string.
*   **Content:** Raw byte string.

## 5. Size Considerations and Limitations

*   **Witness Data Discount:** Data in the witness benefits from the witness discount (1/4th the weight of core block data).
*   **Individual Data Push Limit:** Each data push opcode (e.g., `OP_PUSH <bytes>`) can push at most 520 bytes.
*   **Overall Script Size:** While Taproot scripts have generous limits, excessively large scripts can lead to higher transaction fees and potential issues with relay or mining.
*   **Total Transaction Size:** Bitcoin transactions have a standard maximum size (typically around 100KB, though larger can exist, they are non-standard).
*   **Recommendation:** Metadata (DID+VC) should be kept as concise as possible. Consider methods for minimizing the size of DID Documents and VCs if they become too large (e.g., using compact contexts for JSON-LD based VCs before CBOR encoding).

## 6. Parsing and Indexing

*   **Ordinals Compatibility:** Standard Ordinals indexers will recognize the `OP_FALSE OP_IF "ord" ...` envelope. They will parse known fields like `content_type`. They will see the `metadata` field (tag 5) and may store its content as an opaque byte string if they don't understand its "ordplus" significance.
*   **Ordinals Plus Indexers:**
    *   Can look for the optional `metaprotocol` field (tag 7) with value `"ordplus/v0.1"`.
    *   Alternatively, or in addition, they can specifically parse the content of the `metadata` field (tag 5), attempting to decode it as CBOR and then interpret the DID/VC structure within.
    *   Must correctly reassemble chunked data pushes for both metadata and content.

## 7. Security Considerations

*   **Standard Bitcoin Security:** Relies on the underlying security of the Bitcoin network and Taproot.
*   **Data Integrity:** Once confirmed on the blockchain, the inscription data (including metadata) is immutable.
*   **No Script Execution:** The data within the `OP_FALSE OP_IF ... OP_ENDIF` envelope is not executed by Bitcoin nodes, posing no direct risk to script validation.

## 8. Open Questions / Future Considerations

*   **Exact CBOR Structure for DID+VC:** The internal schema of the CBOR object holding the DID Document and VC needs its own detailed specification. How are these two pieces of information distinguished within the single CBOR byte string? (e.g., a map with keys like `"didDocument"` and `"verifiableCredential"`).
*   **Metadata Size Management:** Strategies for handling very large DID/VC data if direct embedding becomes prohibitive.
*   **Versioning of Ordinals Plus:** The metaprotocol identifier (`"ordplus/v0.1"`) provides a basic versioning mechanism. Future versions might use different identifiers or add/modify fields. 