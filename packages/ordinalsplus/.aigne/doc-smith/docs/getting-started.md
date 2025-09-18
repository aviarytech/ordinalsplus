# Getting Started

This guide provides the essential steps to install the Ordinals Plus library and run a basic code example. You will learn how to interact with BTCO DIDs and resolve their linked resources, allowing you to quickly integrate these functionalities into your application.

## Installation

To add the library to your project, use your preferred package manager. The package name is `ordinalsplus`.

```bash
npm install ordinalsplus
# or
yarn add ordinalsplus
# or
bun add ordinalsplus
```

## Basic Usage Example

After installation, you can begin interacting with the Bitcoin blockchain. The following TypeScript example demonstrates two primary functions: handling a BTCO DID and resolving a DID-linked resource using an external provider like Ordiscan.

Save the code below as `example.ts`:

```typescript
import OrdinalsPlus, { BtcoDid, ResourceResolver, ProviderType } from 'ordinalsplus';

async function runExample() {
  // --- Part 1: Working with DIDs ---

  // Create a DID object from a DID string
  const did = new BtcoDid('did:btco:1908770696977240');
  console.log(`DID: ${did.getDid()}`);
  console.log(`Sat Number: ${did.getSatNumber()}`);

  // Validate the format of a DID string
  const isValid = OrdinalsPlus.utils.isValidBtcoDid('did:btco:1908770696977240');
  console.log(`Is the DID format valid? ${isValid}`);


  // --- Part 2: Working with Linked Resources ---

  // Initialize a resolver with the Ordiscan provider
  const resolver = new ResourceResolver({
      type: ProviderType.ORDISCAN,
      options: {
          apiKey: 'your-api-key', // API key is optional for some endpoints
          apiEndpoint: 'https://api.ordiscan.com'
      }
  });

  // Fetch the content of a resource linked to a DID
  try {
    const resource = await resolver.resolve('did:btco:1908770696991731/0');
    console.log(`\nContent Type: ${resource.contentType}`);
    console.log(`Content: ${JSON.stringify(resource.content)}`);
  } catch (error) {
    console.error("Error resolving resource:", error);
  }
}

runExample();
```

### Running the Example

You can execute the script directly if you are using `bun`:

```bash
bun run example.ts
```

This script will connect to the Ordiscan API, parse the DID, and fetch the associated resource data, logging the results to your console.

## Next Steps

Now that you have a basic implementation working, you can explore the library's architecture and advanced features.

*   Learn about the fundamental principles in **[Core Concepts](./core-concepts.md)**.
*   Browse the complete **[API Reference](./api-reference.md)** for detailed documentation on all available methods and classes.