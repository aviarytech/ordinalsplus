# Changelog

A detailed history of all notable changes, feature additions, and bug fixes for each version of the Ordinals Plus library.

## [1.0.2](https://github.com/aviarytech/ordinalsplus/compare/v1.0.1...v1.0.2) (2025-07-23)


### Bug Fixes

* add ESLint configuration for ordinalsplus package to fix workflow ([d06d728](https://github.com/aviarytech/ordinalsplus/commit/d06d728695c6ae238b5bbe53c0e27b0e41233e00))

## [1.0.1](https://github.com/aviarytech/ordinalsplus/compare/v1.0.0...v1.0.1) (2025-07-23)


### Bug Fixes

* **resourceInscriptionService:** streamline imports and enhance type definitions ([f6dc03c](https://github.com/aviarytech/ordinalsplus/commit/f6dc03c66b78c99c296f3c4c563ade288ea1b86b))

# 1.0.0 (2025-07-23)


### Bug Fixes

* address miscellaneous issues ([5b42843](https://github.com/aviarytech/ordinalsplus/commit/5b42843a9c26f507640b4811fe233730626af985))


### Features

* add automatic UTXO selection with manual override option ([5a30a39](https://github.com/aviarytech/ordinalsplus/commit/5a30a39dfd823546e833b7e716edbacf423926d2))
* add configure script and setup docs for installing Bun and dependencies ([a4df05e](https://github.com/aviarytech/ordinalsplus/commit/a4df05ef7049d4cc3f530c5c7316bc289f881296))
* add UTXO sat number retrieval and CreateDidButton component for BTCO DID creation ([bfc8215](https://github.com/aviarytech/ordinalsplus/commit/bfc821534a0e3b6de26a644e659c8b07101c745d))
* **api:** Implement robust error handling and retry logic for VC API integration (task [#3](https://github.com/aviarytech/ordinalsplus/issues/3).3) ([49592dc](https://github.com/aviarytech/ordinalsplus/commit/49592dc8ba8cff7645df5c70f2c7046d051a9411))
* **api:** Implement UTXO selection algorithm for task 4.3 - Developed UTXO selection in bitcoinRpc.ts, size estimation in txSizeEstimator.ts. Includes unit tests, fee optimization, dynamic fees, change handling. Aligns with spec plan_4.3_utxo_selection.md. Subtask 4.3. ([7c3c8a3](https://github.com/aviarytech/ordinalsplus/commit/7c3c8a3dd56fe07088b4717373ba8bd03c6c9585))
* **api:** Introduce new collection management features in Ordinals Plus Explorer ([3a0d5b0](https://github.com/aviarytech/ordinalsplus/commit/3a0d5b098007b2243594e1910803d25324b9ef89))
* **cbor:** Implement CBOR encoding for Ordinals Plus metadata for subtask 4.2 - Added metadataEncoder utility with functions to encode DID/VC to CBOR and estimate size. - Implemented unit tests for the encoder. - Updated transaction spec with CBOR internal structure and utility references. - Added Jest types to tsconfig. - Logged detailed plan and reflection. - No rule changes. ([62d9eb7](https://github.com/aviarytech/ordinalsplus/commit/62d9eb74b9d34b43847f1a4804238c516759c5b5))
* **config:** add validated env loader ([62ec1ec](https://github.com/aviarytech/ordinalsplus/commit/62ec1ec5419a0cf207b713615343988543314e79))
* **crypto:** Implement Ed25519 key pair generation using @noble/curves - Task 2.1 - Refactored key generation to use @noble/curves for Ed25519 operations, replacing @noble/ed25519 and @noble/hashes. Key generation is now synchronous. Updated Ed25519KeyPair interface and tests accordingly. Added .cursor/rules/cryptography.mdc to document new crypto conventions. ([ac0e328](https://github.com/aviarytech/ordinalsplus/commit/ac0e3286b7364038957d88575c15c253f35c65f1))
* **dependencies:** Update package dependencies and add new modules - Added @noble/ed25519, @noble/secp256k1, canonicalize, and jose to package.json and package-lock.json. - Updated types for pako in package.json. - Refactored didService and vcService to utilize new dependencies for enhanced functionality. - Introduced transaction broadcasting and confirmation services with comprehensive error handling and retry logic. - Added unit tests for transaction broadcasting and confirmation services. ([ee06818](https://github.com/aviarytech/ordinalsplus/commit/ee0681838f01de1a99b1420078ca85988b21aad0))
* **did:** Enhance DID Document functionality with tamper protection and security checks - Added options for tamper protection during document creation, including logging for security events. Implemented key management for adding and revoking keys, and introduced validation checks for security issues in DID documents. Updated interfaces and methods to support these features. ([a9ce3ba](https://github.com/aviarytech/ordinalsplus/commit/a9ce3ba268db14bf7a6c15d6364c77e52cfaf0c3))
* **did:** Implement DID Document Structure for subtask 2.2 - Create keyUtils.ts with Ed25519 key generation and multibase conversion - Implement DID document creation, validation, and serialization - Update DidDocument interface to include authentication field - Add comprehensive test coverage for DID document operations ([0fabe4c](https://github.com/aviarytech/ordinalsplus/commit/0fabe4ca0ebfe2060da1929753c3e0a868ab7164))
* **did:** Implement DID Resolution for subtask 2.3 ([62eab10](https://github.com/aviarytech/ordinalsplus/commit/62eab10433e4a65561f464540f8dcb1708c46e2d))
* enhance verifiable credential support and improve metadata handling ([73d90c5](https://github.com/aviarytech/ordinalsplus/commit/73d90c59649583e5c72ab97659c9f4cbbf42eb39))
* **explorer:** add file upload support for inscriptions ([aeee415](https://github.com/aviarytech/ordinalsplus/commit/aeee4150c26cb7449a218d3754cfd7fa91bdbe54))
* **explorer:** integrate DID page and enhance DidExplorer functionality ([89a0606](https://github.com/aviarytech/ordinalsplus/commit/89a0606883722d94238d8c444645b4fbcd2c6909))
* **github:** add GitHub Actions workflow for npm package publishing and update README ([a429548](https://github.com/aviarytech/ordinalsplus/commit/a4295489fbc64a80aed9b3eddbf595e3ab0402b4))
* implement BTCO DID resolution service and related API endpoints ([5aa5f9d](https://github.com/aviarytech/ordinalsplus/commit/5aa5f9d91560d9ea1d7e20d845ae707f215c59ee))
* implement multi-step resource inscription workflow with VC support ([a9b09b6](https://github.com/aviarytech/ordinalsplus/commit/a9b09b6064f66d73f54d5a8fdcdfbdd4ec251828))
* Implement on-chain collection inscription for task 6.4 - Add collection inscription types, service, repository, controller and API endpoints - Implement batching support for large collections - Add transaction monitoring and status tracking - Create verification system for on-chain collection data ([99e0a1a](https://github.com/aviarytech/ordinalsplus/commit/99e0a1ae2f9a3571bfb1d76b11e10450b1f4f237))
* **indexer:** Add comprehensive error handling and storage ([5c2bc0e](https://github.com/aviarytech/ordinalsplus/commit/5c2bc0e8733f59d3c75b27ea18584d14e10349fa))
* **indexer:** Enhance CBOR metadata parsing and logging (subtask 9.3) ([a797e30](https://github.com/aviarytech/ordinalsplus/commit/a797e30dec681e9e058d43543688492c684a6850))
* **indexer:** enhance inscription retrieval and resource management ([3bed335](https://github.com/aviarytech/ordinalsplus/commit/3bed335b6029de9f139746f34f690e44b3d54949))
* **indexer:** Implement advanced caching strategy for Ordinals Indexer (Task [#9](https://github.com/aviarytech/ordinalsplus/issues/9).4) ([4c75022](https://github.com/aviarytech/ordinalsplus/commit/4c750220f004c8ddc1b507abd472a284815ecb27))
* **indexer:** Implement Data Synchronization Job for subtask 9.2 ([6dc381c](https://github.com/aviarytech/ordinalsplus/commit/6dc381c88d8a5c88aaae74ec20e481c7f297ab88))
* **indexer:** Implement error handling and recovery mechanisms for subtask 9.5 - Added custom error classes for all error scenarios - Implemented circuit breaker pattern to prevent cascading failures - Created retry mechanism with exponential backoff - Developed DLQ for persistent failures - Built robust logging system with context support - Updated OrdinalsIndexer to use the error handling system ([a432557](https://github.com/aviarytech/ordinalsplus/commit/a43255739616d18cb43ff57869c9998f860ba1f4))
* **indexer:** Implement Ordinals Indexer Client for subtask 9.1 ([657ff84](https://github.com/aviarytech/ordinalsplus/commit/657ff84976bef36c56a3a3d476c13485f734d486))
* **key-manager:** Implement singleton pattern and enhance key creation with multiple aliases - Added a singleton instance method for KeyManager and updated createKey to support storing multiple aliases for generated keys, improving key management flexibility. ([eb9a42d](https://github.com/aviarytech/ordinalsplus/commit/eb9a42ddc4efde32e0d6063ee444aec0e5ac4c9b))
* **keys:** Implement Key Management System for subtask 2.7 ([e228b60](https://github.com/aviarytech/ordinalsplus/commit/e228b600b435eb4068f5d19358a03e672b14f867))
* **scripts:** add start scripts for ordinals-plus-api and ordinals-plus-explorer ([535369a](https://github.com/aviarytech/ordinalsplus/commit/535369a6326ed2a84c3d4c0b519fecbbae4f017c))
* **spec:** Define transaction structure for Ordinals Plus inscriptions for subtask 4.1 - Created detailed specification document outlining envelope structure, field usage (content type, metadata, metaprotocol), data encoding (CBOR for metadata), size considerations, and parsing/indexing implications for embedding DID/VC. - Leverages standard Ordinals tags (e.g., metadata tag 5). - No rule changes. ([12572f6](https://github.com/aviarytech/ordinalsplus/commit/12572f6d6abaf6f47a585b0f898446e028010c16))
* **ui:** Enhance MetadataForm with UI/UX elements for subtask 1.3 - Adds Tooltip components for field guidance, a general help text about data permanence, and comments for future responsive design and enhanced visual validation feedback. Improves accessibility with aria-labels for dynamic property fields. ([461dde6](https://github.com/aviarytech/ordinalsplus/commit/461dde6804576236c18169c20b9d6b7bd68c99cf))
* **ui:** Implement initial structure for MetadataForm component for subtask 1.1 - Includes interfaces (VerifiableMetadata, MetadataFormProps), basic state management, and JSX layout for form fields. Placeholder UI components used pending integration with actual UI library. ([68a68ec](https://github.com/aviarytech/ordinalsplus/commit/68a68ec51ed8ea54a450d813761a8421735a2d01))
* **ui:** Implement validation logic for MetadataForm for subtask 1.2 - Adds error state, validation functions, real-time validation for required fields (title, description) and date format. Includes character limits and improved dynamic property handling with add/remove and basic validation. Displays error messages. ([7e574d9](https://github.com/aviarytech/ordinalsplus/commit/7e574d9c406a2864b22bc23dcdc45f20e1242a96))
* update BTCO DID handling and enhance resource management ([0ea3947](https://github.com/aviarytech/ordinalsplus/commit/0ea39472ec565f9cac1d28444520f28d402de942))
* **vc:** Enhance VCService with credential repository and signature verification improvements ([6630c97](https://github.com/aviarytech/ordinalsplus/commit/6630c97e83250116d613015de3e1bede9c516a31))
* **vc:** Implement API Client for Aces VC API - Created API client with retry logic, error handling, and request formatting. Built a higher-level VC service that integrates with DID resolver for credential verification. ([7acb10c](https://github.com/aviarytech/ordinalsplus/commit/7acb10c3c9d3bf1af6dd9ba1f51ea2672fa6614f))
* **vc:** Implement Credential Data Preparation for subtask 3.1 - Created VC types, formatters, validators, and exports according to W3C VC Data Model 2.0 ([09b21a9](https://github.com/aviarytech/ordinalsplus/commit/09b21a968fb213a56b88e23b37940f0a469e758b))
* **wallet:** add Wallet UTXOs page and integrate UTXO classification ([c954f3a](https://github.com/aviarytech/ordinalsplus/commit/c954f3ac5dc2f37a70da82caa6bc5b7a00d4dffe)).