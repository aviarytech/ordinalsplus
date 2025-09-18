# API Reference

This section provides a complete reference for all public classes, functions, and types in the Ordinals Plus library. The API is organized into modules based on functionality to help you find what you need quickly. Each module below links to a detailed page with function signatures, parameters, and code examples.

For a more conceptual understanding of these components, see the [Core Concepts](./core-concepts.md) section.

## Modules Overview

The library's public API is divided into the following modules:

### [DIDs](./api-reference-dids.md)

The DIDs module provides the tools for creating, resolving, and validating `did:btco` Decentralized Identifiers. It includes the primary resolver class and various utility functions for handling DID syntax.

| Key Exports | Description |
|---|---|
| `BtcoDidResolver` | A class to resolve `did:btco` DIDs to DID Documents. |
| `createDidFromInscriptionData` | Creates a DID string from inscription details. |
| `isBtcoDid` | Checks if a given string is a valid BTCO DID. |
| `parseBtcoDid` | Parses a BTCO DID string into its components. |

### [Resources](./api-reference-resources.md)

The Resources module is used for managing DID Linked Resources. It includes the `ResourceResolver` for fetching resource content and a system of providers for different data sources like Ordiscan or a local Ord node.

| Key Exports | Description |
|---|---|
| `ResourceResolver` | A class to resolve resource identifiers to their content. |
| `createLinkedResourceFromInscription` | Creates a linked resource object from an inscription. |
| `OrdiscanProvider` | A provider that fetches resource data from the Ordiscan API. |
| `OrdNodeProvider` | A provider that fetches resource data from a self-hosted `ord` node. |
| `resource-utils` | A collection of utility functions for validating and parsing resources. |

### [Transactions](./api-reference-transactions.md)

This module handles the entire lifecycle of creating Bitcoin inscriptions, from preparing the data to building, signing, and broadcasting the two-phase commit and reveal transactions. It also includes tools for tracking transaction status.

| Key Exports | Description |
|---|---|
| `prepareResourceInscription` | Prepares the data and parameters for a new resource inscription. |
| `prepareCommitTransaction` | Creates the commit transaction PSBT. |
| `createRevealTransaction` | Creates the reveal transaction PSBT from the commit transaction output. |
| `TransactionStatusTracker` | A class to monitor the status of pending transactions. |
| `createInscription` | A high-level function to create a simple text or JSON inscription. |

### [Key Management](./api-reference-key-management.md)

The Key Management module offers a flexible system for generating and managing cryptographic key pairs used for signing transactions and other operations. It supports various algorithms including secp256k1, Ed25519, and Schnorr.

| Key Exports | Description |
|---|---|
| `KeyManager` | Manages a collection of key pairs and provides signing capabilities. |
| `KeyPairGenerator` | A class to generate different types of cryptographic key pairs. |
| `generateSecp256k1KeyPair` | A function to generate a new secp256k1 key pair. |

### [Verifiable Credentials](./api-reference-verifiable-credentials.md)

This module provides a service for issuing and verifying W3C-compliant Verifiable Credentials (VCs) for Bitcoin inscriptions. It is designed to integrate with an external VC service API.

| Key Exports | Description |
|---|---|
| `VCService` | A service class for interacting with a Verifiable Credentials API. |

### [Indexer](./api-reference-indexer.md)

The Indexer module provides a client for interacting with an ordinals indexer service. It is used to query for inscription data, which is essential for DID and resource resolution.

| Key Exports | Description |
|---|---|
| `OrdinalsIndexer` | A client for querying inscription data from an indexer. |
| `MemoryIndexerDatabase` | An in-memory database implementation for caching indexer data. |

### [Utilities](./api-reference-utilities.md)

The Utilities module contains a collection of helper functions for various low-level tasks, including address manipulation, CBOR encoding/decoding, PSBT finalization, network configuration, and constants.

| Key Exports | Description |
|---|---|
| `address-utils` | Functions for working with Bitcoin addresses. |
| `cbor-utils` | Functions for encoding and decoding data using the CBOR format. |
| `psbt-utils` | Helpers for finalizing and extracting transactions from PSBTs. |
| `networks` | Network configuration constants for mainnet, testnet, etc. |

---

Select a module to explore its functions, classes, and types in depth. If you are new to the library, you might want to start with the [Getting Started](./getting-started.md) guide.