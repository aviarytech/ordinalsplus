# Ordiscan Provider Metadata Implementation

## Overview

The `OrdiscanProvider.getMetadata()` function has been updated to retrieve real CBOR metadata from inscriptions using the Ordiscan API. This replaces the previous placeholder implementation that only returned basic inscription information.

## Implementation Details

### API Integration

The implementation now properly utilizes the Ordiscan API's `/inscription/{id}` endpoint, which returns a `metadata` field containing:

- **Decoded JSON Object**: When the API returns metadata as a JavaScript object, it's returned directly
- **Hex-encoded CBOR String**: When metadata is returned as a hex string, it's decoded using the project's CBOR utilities
- **Null/Undefined**: When no metadata exists, the function returns `null`

### Key Features

1. **Multiple Format Support**: Handles both pre-decoded JSON objects and hex-encoded CBOR strings
2. **Error Handling**: Gracefully handles CBOR decoding errors and invalid hex strings
3. **CBOR Decoding**: Uses the project's existing `extractCborMetadata` utility function
4. **Performance**: Dynamic imports for CBOR utilities to avoid loading overhead when not needed

### Interface Updates

The `OrdiscanInscriptionResponse` interface has been extended to include additional fields from the Ordiscan API:

```typescript
interface OrdiscanInscriptionResponse {
    // ... existing fields
    metadata?: any; // CBOR metadata, can be object or string (hex-encoded)
    metaprotocol?: string | null; // Metaprotocol identifier
    parent_inscription_id?: string | null; // Parent inscription ID
    delegate_inscription_id?: string | null; // Delegate inscription ID
    satributes?: string[]; // Sat attributes
    collection_slug?: string | null; // Collection identifier
    brc20_action?: any | null; // BRC-20 action object
    sats_name?: string | null; // Sats name
    submodules?: string[]; // Recursive inscription modules
}
```

## Usage

```typescript
const provider = new OrdiscanProvider({
    apiKey: 'your-api-key',
    network: 'mainnet'
});

// Get metadata for an inscription
const metadata = await provider.getMetadata('inscription-id');

if (metadata) {
    // Metadata exists and was successfully decoded
    console.log('DID Document:', metadata.didDocument);
    console.log('Verifiable Credential:', metadata.verifiableCredential);
} else {
    // No metadata or decoding failed
    console.log('No metadata available');
}
```

## Error Handling

The function includes comprehensive error handling:

- Invalid hex strings are caught and logged with warnings
- CBOR decoding errors are handled gracefully
- Network errors are propagated from the underlying API call
- Missing or null metadata fields return `null` instead of throwing errors

## Testing

The implementation includes unit tests covering:

- No metadata present
- Metadata as JavaScript object
- Invalid hex-encoded metadata strings
- Null metadata values

Run tests with:
```bash
npm test -- ordiscan-provider.test.ts
```

## Dependencies

- **CBOR Utils**: Uses the project's existing `extractCborMetadata` function from `../../utils/cbor-utils`
- **Ordiscan API**: Requires valid API key and proper endpoint configuration
- **Fetch Utilities**: Uses the project's `fetchWithTimeout` utility for HTTP requests 