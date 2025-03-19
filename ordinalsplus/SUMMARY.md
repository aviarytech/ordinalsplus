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

### 3. Utility Functions

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
import OrdinalsPlus, { BtcoDid, ResourceResolver } from 'ordinalsplus';

// Working with DIDs
const did = new BtcoDid('did:btco:1234567890');
console.log(`DID: ${did.getDid()}`);
console.log(`Sat Number: ${did.getSatNumber()}`);

// Validate DIDs
const isValid = OrdinalsPlus.utils.isValidBtcoDid('did:btco:1234567890');

// Working with resources
const resolver = new ResourceResolver();
const resourceInfo = await resolver.resolveInfo('did:btco:1234567890/0');

// Get resource content
const resource = await resolver.resolve('did:btco:1234567890/0');
console.log(`Content Type: ${resource.contentType}`);
console.log(`Content: ${JSON.stringify(resource.content)}`);

// Working with collections
const collectionPage = await resolver.resolveCollection('did:btco:1234567890/0');
console.log(`Items: ${collectionPage.items.length}`);
console.log(`Total: ${collectionPage.total}`);
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

## Next Steps

- Add more examples for different resource types
- Implement caching for API responses
- Add support for creating and publishing DIDs and resources
- Create a browser-friendly build for web applications 