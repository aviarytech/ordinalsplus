# Ordinals Plus Library

## Overview

The Ordinals Plus library provides a TypeScript/JavaScript SDK for working with BTCO DIDs (Decentralized Identifiers) and DID Linked Resources on the Bitcoin blockchain. This library makes it easy to interact with DIDs and resources inscribed via the Bitcoin Ordinals protocol.

## Components

The library consists of the following main components:

### 1. BtcoDid

The `BtcoDid` class provides methods for working with BTCO DIDs:

- Create a DID object from a DID string
- Validate DID formats
- Resolve DIDs to DID Documents
- Get sat numbers and other DID components

### 2. ResourceResolver

The `ResourceResolver` class provides methods for working with DID Linked Resources:

- Resolve resources by their identifiers
- Get resource information and metadata
- Work with resource collections
- Handle heritage relationships (parent/child)
- Access resources controlled by the same wallet
- Support for multiple provider types (Ordiscan, Ord)
- Automatic conversion from resource IDs to inscription IDs
- Comprehensive error handling for invalid IDs and network issues

### 3. Provider System

The library includes a flexible provider system:

- Abstract provider interface for blockchain interaction
- Factory pattern for provider creation
- Support for Ordiscan and Ord node providers
- Extensible design for additional providers
- Mock provider for testing

### 4. Utility Functions

The library includes various utility functions for:

- Validating DID and resource identifier formats
- Parsing DID strings and resource identifiers
- Making API requests to Ordinals services
- Working with error codes and handling error responses

## Directory Structure

```
ordinalsplus/
├── src/                     # Source code directory
│   ├── did/                 # DID classes
│   │   └── btco-did.ts      # BtcoDid implementation
│   ├── resources/           # Resource classes
│   │   ├── providers/       # Provider implementations
│   │   │   ├── provider-factory.ts
│   │   │   ├── ordiscan-provider.ts
│   │   │   └── ord-node-provider.ts
│   │   └── resource-resolver.ts # ResourceResolver implementation
│   ├── types/               # TypeScript types
│   │   └── index.ts         # Type definitions
│   ├── utils/               # Utility functions
│   │   ├── api-client.ts    # API client
│   │   ├── constants.ts     # Constants
│   │   └── validators.ts    # Validator functions
│   └── index.ts             # Main entry point
├── examples/                # Example code
│   └── basic-usage.ts       # Basic usage example
├── test/                    # Test directory
│   ├── btco-did.test.ts     # Tests for BtcoDid
│   └── resource-resolver.test.ts # Tests for ResourceResolver
├── package.json             # NPM package configuration
├── tsconfig.json            # TypeScript configuration
├── README.md                # Library documentation
└── build.sh                 # Build script
```

## Usage Example

```typescript
import OrdinalsPlus, { BtcoDid, ResourceResolver, ProviderType } from 'ordinalsplus';

// Working with DIDs
const did = new BtcoDid('did:btco:1908770696977240');
console.log(`DID: ${did.getDid()}`);
console.log(`Sat Number: ${did.getSatNumber()}`);

// Validate DIDs
const isValid = OrdinalsPlus.utils.isValidBtcoDid('did:btco:1908770696977240');

// Working with resources using Ordiscan provider
const resolver = new ResourceResolver({
    type: ProviderType.ORDISCAN,
    options: {
        apiKey: 'your-api-key',
        apiEndpoint: 'https://api.ordiscan.com'
    }
});

// Get resource content
const resource = await resolver.resolve('did:btco:1908770696991731/0');
console.log(`Content Type: ${resource.contentType}`);
console.log(`Content: ${JSON.stringify(resource.content)}`);

// Working with collections
const collection = await resolver.resolveCollection();
console.log(`Items: ${collection.length}`);

// Using Ord node provider
const ordResolver = new ResourceResolver({
    type: ProviderType.ORD,
    options: {
        nodeUrl: 'http://localhost:8080'
    }
});
```

## Development

To develop the library:

1. Clone the repository
2. Install dependencies with `bun install`
3. Run tests with `bun test`
4. Build the library with `bun run build`
5. Run the example with `bun run example`

Or use the build script:

```bash
./build.sh
```

## Testing

The library includes comprehensive testing:

- Unit tests for core functionality
- Mock provider for testing
- Test cases for all major features
- Error handling verification
- Provider type validation
- Test coverage for ResourceResolver and Provider Factory

## Next Steps

- Add more examples for different resource types
- Implement caching for API responses
- Add support for creating and publishing DIDs and resources
- Create a browser-friendly build for web applications
- Add more provider implementations
- Enhance error handling and recovery
- Add performance optimizations for large collections 