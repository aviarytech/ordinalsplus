# Ordinals Plus Library

A JavaScript/TypeScript library for working with BTCO DIDs (Decentralized Identifiers) and DID Linked Resources on the Bitcoin blockchain using Ordinal Theory and Inscriptions.

[![Built with Bun](https://img.shields.io/badge/Built%20with-Bun-brightgreen)](https://bun.sh/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Overview

Ordinals Plus is a library for working with decentralized identifiers and linked resources on the Bitcoin blockchain leveraging Ordinal Theory and Inscriptions. This library implements the BTCO DID Method and BTCO DID Linked Resources specifications, providing tools to create, resolve, update, and manage DIDs and their associated resources.

## Specifications

This library implements the following specifications:

### BTCO DID Method (v0.2.0)

The BTCO DID Method specification defines how to create, resolve, update, and deactivate DIDs on the Bitcoin blockchain using Ordinal Theory and Inscriptions.

Key features:
- DID syntax: `did:btco:<sat-number>` (e.g., `did:btco:1066296127976657`)
- Create DIDs by inscribing JSON-LD DID Documents on specific satoshis
- Update DIDs through reinscriptions
- Deactivate DIDs by including explicit deactivation statements
- Compatible with W3C DID Core specification

### BTCO DID Linked Resources (v0.2.0)

The BTCO DID Linked Resources extension provides a standardized framework for associating immutable resources with DIDs through Bitcoin Ordinal inscriptions.

Key features:
- Resource identification through DIDs and inscription indices (e.g., `did:btco:1954913028215432/0`)
- Resource information accessed via `/info` suffix
- Resource metadata accessed via `/meta` suffix
- Various resource collection types:
  - DID Collections (via reinscriptions)
  - Heritage Collections (parent/child relationships)
  - Controller Collections (based on wallet address)
  - Curated Collections (using Verifiable Credentials)
- Support for various resource types (schemas, status lists, visual representations, etc.)

### BTCO Verifiable Metadata (v0.2.0)

The BTCO Verifiable Metadata specification defines how to create and verify metadata about Bitcoin Ordinal inscriptions using the W3C Verifiable Credentials Data Model, enabling trustless verification of inscription properties and collection curation.

## Features

- Create and manage BTCO DIDs
- Associate resources with DIDs through inscriptions
- Resolve DIDs and linked resources
- Verify DID ownership and resource authenticity
- Query and manage resource collections
- Support for versioning through reinscriptions
- Compatible with W3C DID and VC standards

## Installation

```bash
# Using bun
bun install ordinalsplus

# Using npm
npm install ordinalsplus

# Using yarn
yarn add ordinalsplus
```

## Quick Start

```typescript
import { BtcoDid, ResourceResolver } from 'ordinalsplus';

// Create a new BTCO DID instance
const did = new BtcoDid('did:btco:1066296127976657');

// Resolve a DID document
const didDocument = await did.resolve();

// Access a linked resource
const resourceResolver = new ResourceResolver();
const resource = await resourceResolver.resolve('did:btco:1954913028215432/0');

// Get resource information
const resourceInfo = await resourceResolver.resolveInfo('did:btco:1954913028215432/0');

// Get resource metadata
const resourceMeta = await resourceResolver.resolveMeta('did:btco:1954913028215432/0');
```

## Key Concepts

### Ordinal Theory and Inscriptions

Ordinal Theory assigns unique identities to individual bitcoin satoshis (sats), enabling them to be tracked, transferred, and inscribed with additional data. Inscriptions are arbitrary content added to BTC satoshis to create BTC-native digital artifacts.

### DID Linked Resources

DID Linked Resources are digital resources cryptographically linked to DIDs through BTC Ordinal inscriptions. They can include various types of content like credential schemas, governance frameworks, logos, status lists, and more.

### Resource Collections

Resources can be organized into collections:
- **DID Collections**: Multiple resources linked to a specific satoshi through reinscriptions
- **Heritage Collections**: Parent/child relationships between resources
- **Controller Collections**: Resources linked through the wallet address currently holding them
- **Curated Collections**: Resources linked through a Verifiable Credential that includes a list of resources

## API Reference

Detailed API documentation is available at [docs.ordinalsplus.com](https://docs.ordinalsplus.com).

## Contributing

Contributions are welcome! Please check out our [contributing guidelines](CONTRIBUTING.md) to get started.

## Security Considerations

- Resources maintain their original content without modification
- Altered resources should be treated as invalid
- Use HTTPS for all resource endpoint communications
- Validate resource integrity using cryptographic proofs when available

## Privacy Considerations

- Resources should not contain personally identifiable information (PII)
- If PII is necessary, it should be stored off-chain with references
- Implement data retention policies for cached resources
- Avoid linking multiple resources to the same address unless necessary

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Resources

- [Ordinals Plus Website](https://ordinals.plus/)
- [BTCO DID Method Specification](https://identity.foundation/labs-ordinals-plus/btco-did-method)
- [BTCO DID Linked Resources Specification](https://identity.foundation/labs-ordinals-plus/btco-did-linked-resources)
- [BTCO Verifiable Metadata Specification](https://identity.foundation/labs-ordinals-plus/btco-vm)
- [Bitcoin Ordinals](https://ordinals.com/)

## Blockchain Providers

The `ordinalsplus` library now includes built-in support for connecting to different Bitcoin Ordinals providers. This allows you to easily fetch inscriptions and work with DIDs without implementing your own blockchain integration.

### Using the Ordinals Provider

```typescript
import { getOrdinalsProvider } from 'ordinalsplus';

// Initialize a provider with an API key
const provider = getOrdinalsProvider('ordiscan', 'YOUR_API_KEY');

// Fetch inscriptions with pagination
const inscriptions = await provider.fetchInscriptions(0, 10);
console.log(`Found ${inscriptions.total} inscriptions`);

// Fetch a specific inscription by ID
const inscription = await provider.fetchInscriptionById('abc123');
if (inscription) {
  console.log(`Found inscription: ${inscription.id}`);
}

// Fetch the content of an inscription
const content = await provider.fetchInscriptionContent('abc123', 'application/json');
console.log('Content:', content);
```

### Supported Providers

- **Ordiscan**: Connect to the Ordiscan API for inscription data
- **OrdNode**: (Coming soon) Connect to a local Ord node
- **Mock**: (Coming soon) Use mock data for testing

### Using the OrdinalsService

For more advanced usage, you can use the `OrdinalsService` directly:

```typescript
import { OrdinalsService } from 'ordinalsplus';

// Get the singleton instance of the service
const service = OrdinalsService.getInstance();

// Initialize a provider with options
const provider = service.initProvider('ordiscan', {
  apiKey: 'YOUR_API_KEY',
  endpoint: 'https://api.ordiscan.com/v1'
});

// Use the provider
const inscriptions = await provider.fetchInscriptions();
```

### Implementing Custom Providers

You can implement your own providers by implementing the `IOrdinalsProvider` interface:

```typescript
import { IOrdinalsProvider, BaseOrdinalsProvider } from 'ordinalsplus';

// Extend the base provider class
class MyCustomProvider extends BaseOrdinalsProvider {
  // Implement the required methods
  async fetchInscriptions() {
    // Your implementation
  }
  
  // ... other methods
}

// Register your provider with the service
OrdinalsService.getInstance().registerProvider('custom', () => new MyCustomProvider());
``` 