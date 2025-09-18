# Utilities

The Utilities module provides a collection of helper functions for common tasks such as data validation, encoding, transaction manipulation, and error handling. These functions are used throughout the library and are exposed for developers who may need to perform these operations directly.

## Address Utilities

Functions for handling Bitcoin addresses, primarily for fetching Unspent Transaction Outputs (UTXOs).

### `getAddressUtxos`

Fetches UTXOs for a given Bitcoin address, automatically excluding any UTXOs known to contain Ordinal inscriptions. This is crucial for gathering spendable UTXOs that will not inadvertently transfer a valuable ordinal.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `address` | `string` | The Bitcoin address to fetch UTXOs for. |
| `provider` | `ResourceProvider` | An instance of a resource provider (e.g., `OrdiscanProvider`) to identify ordinal locations. |
| `network` | `'mainnet' \| 'testnet' \| 'signet'` | The target Bitcoin network. Defaults to `'mainnet'`. |

**Returns**

`Promise<Utxo[]>`: A promise that resolves to an array of spendable, non-ordinal UTXO objects.

**Example**

```typescript
// This example assumes a ResourceProvider, like OrdiscanProvider, is instantiated.
import { getAddressUtxos } from 'ordinals-plus';
import { OrdiscanProvider } from 'ordinals-plus/resources/providers';

async function fetchSpendableUtxos(address, apiKey) {
  try {
    const provider = new OrdiscanProvider({ apiKey });
    const utxos = await getAddressUtxos(address, provider, 'mainnet');
    console.log(`Found ${utxos.length} spendable UTXOs:`, utxos);
    // Each object in the 'utxos' array is suitable for funding a new transaction.
  } catch (error) {
    console.error('Failed to fetch UTXOs:', error);
  }
}

// Replace with a real address and API key
fetchSpendableUtxos('bc1q...', 'your_ordiscan_api_key');
```

## CBOR (Concise Binary Object Representation) Utilities

These functions handle the encoding and decoding of data using CBOR, which is the standard format for embedding metadata like DID Documents within inscriptions.

### `encodeCbor`

Encodes a JavaScript object into a CBOR-formatted `Uint8Array`.

```typescript
import { encodeCbor } from 'ordinals-plus/utils';

const didDocument = {
  '@context': 'https://www.w3.org/ns/did/v1',
  'id': 'did:btco:12345',
  'service': [{
    'id': '#files',
    'type': 'LinkedDomains',
    'serviceEndpoint': 'https://example.com/files'
  }]
};

const encodedData = encodeCbor(didDocument);
console.log('Encoded CBOR (Uint8Array):', encodedData);
```

### `decodeCbor`

Decodes a hex-encoded CBOR string back into a JavaScript object.

```typescript
import { decodeCbor } from 'ordinals-plus/utils';

// This hex string represents a CBOR-encoded object.
const cborHexString = 'a26840636f6e74657874781868747470733a2f2f7777772e77332e6f72672f6e732f6469642f763162696474106469643a6274636f3a3132333435677365727669636581a3626964662366696c657364747970656d4c696e6b6564446f6d61696e736f73657276696365456e64706f696e74781b68747470733a2f2f6578616d706c652e636f6d2f66696c6573';

const decodedObject = decodeCbor(cborHexString);
console.log('Decoded Object:', decodedObject);
```

## PSBT (Partially Signed Bitcoin Transaction) Utilities

Provides functions for working with PSBTs, primarily for finalizing them after signing and extracting the raw transaction hex for broadcasting.

### `finalizeAndExtractTransaction`

This is a convenience function that finalizes a PSBT and extracts the raw transaction hex in a single step. It automatically detects if the input string is in base64 or hex format.

**Parameters**

| Name | Type | Description |
|---|---|---|
| `psbtStr` | `string` | The signed PSBT as a base64 or hex-encoded string. |

**Returns**

`string`: The raw transaction hex, ready to be broadcast to the Bitcoin network.

**Example**

```typescript
import { finalizeAndExtractTransaction } from 'ordinals-plus/utils';

// A PSBT string, typically received after a user signs it with their wallet.
const signedPsbtBase64 = 'cHNidP8BAgMEAAA...'; 

try {
  const rawTxHex = finalizeAndExtractTransaction(signedPsbtBase64);
  console.log('Final Raw Transaction Hex:', rawTxHex);
  // This hex string can now be broadcast.
} catch (error) {
  console.error('Failed to finalize and extract transaction:', error);
}
```

## Validators

A set of pure functions to validate and parse BTCO-specific formats like DIDs and Resource IDs.

| Function | Description |
|---|---|
| `isValidBtcoDid(did: string)` | Checks if a string is a structurally valid BTCO DID. Returns `true` or `false`. |
| `parseBtcoDid(did: string)` | Parses a valid BTCO DID into its components (`did`, `satNumber`, `network`). Returns an object or `null` if invalid. |
| `isValidResourceId(id: string)` | Checks if a string is a valid DID Linked Resource ID. Returns `true` or `false`. |
| `parseResourceId(id: string)` | Parses a valid Resource ID into its components (`did`, `satNumber`, `index`, `network`). Returns an object or `null` if invalid. |

**Example**

```typescript
import { isValidBtcoDid, parseResourceId } from 'ordinals-plus/utils';

const did = 'did:btco:test:1234567890';
console.log(`Is DID valid? ${isValidBtcoDid(did)}`); // true

const resourceId = 'did:btco:1234567890/0';
const parsedResource = parseResourceId(resourceId);
console.log('Parsed Resource:', parsedResource);
// { did: 'did:btco:1234567890', satNumber: '1234567890', index: 0, network: 'mainnet' }
```

## Error Handling

The library uses a structured error system to provide detailed information about issues. All library-specific errors are instances of `InscriptionError`.

The `errorHandler` singleton is available to create and handle errors.

**Example: Catching and Handling Errors**

```typescript
import { InscriptionError, ErrorCode } from 'ordinals-plus/utils';

async function someRiskyOperation() {
  // ... function that throws an InscriptionError
}

try {
  await someRiskyOperation();
} catch (error) {
  if (error instanceof InscriptionError) {
    console.error(`Error Code: ${error.code}`);
    console.error(`Category: ${error.category}`);
    console.error(`Message: ${error.message}`);
    console.error(`Suggested Action: ${error.suggestion}`);

    if (error.code === ErrorCode.INSUFFICIENT_FUNDS) {
      // Custom logic to prompt the user to add funds to their wallet.
    }
  } else {
    console.error('An unexpected error occurred:', error);
  }
}
```

## Recovery Utilities

These are tools to help build more resilient applications by handling transient failures and preserving state during complex flows like inscriptions.

### `retryOperation`

Wraps a function (typically an API call) and retries it with exponential backoff if it fails. This is useful for dealing with intermittent network issues.

**Example**

```typescript
import { retryOperation } from 'ordinals-plus/utils';

// A hypothetical API call that might fail due to network issues
async function fetchFromUnreliableApi() {
  // ... logic to fetch data
}

async function robustFetch() {
  try {
    const result = await retryOperation(fetchFromUnreliableApi, {
      maxRetries: 4,      // Attempt up to 4 times
      initialDelay: 1500, // Wait 1.5s before the first retry
    });
    console.log('API call successful:', result);
  } catch (error) {
    console.error('API call failed after multiple retries:', error);
  }
}
```

### `statePreservation`

Provides a simple interface to save and load application state to `localStorage`. This is useful for resuming a multi-step process, like the commit/reveal transaction flow, if the user accidentally closes their browser tab.

**Example**

```typescript
import { statePreservation } from 'ordinals-plus/utils';

// At the start of a multi-step process
const currentState = { step: 'commit_pending', commitTxId: 'abc...' };
statePreservation.saveState('inscription_flow', currentState);

// When the application reloads
const savedState = statePreservation.loadState('inscription_flow');
if (savedState) {
  console.log('Resuming from saved state:', savedState);
  // Restore the UI and application logic to the saved step
}

// Once the process is complete
statePreservation.clearState('inscription_flow');
console.log('Inscription flow state cleared.');
```

These utility functions provide the low-level building blocks needed for robustly interacting with the Bitcoin blockchain and Ordinals.