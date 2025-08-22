# Batch Commit Transaction

The Batch Commit Transaction feature allows you to create multiple inscription commits in a single Bitcoin transaction. This is more efficient than creating individual commit transactions for each inscription, as it reduces transaction fees and blockchain space usage.

## Overview

The batch commit transaction creates one Bitcoin transaction with multiple outputs, where each output represents a commit for a different inscription. Each inscription can have its own:
- Content (text, JSON, binary data, etc.)
- Content type (MIME type)
- Metadata
- Postage amount (the number of satoshis allocated to that inscription)

## Key Features

- **Multiple inscriptions in one transaction**: Create up to hundreds of inscriptions in a single commit transaction
- **Postage control**: Specify the exact amount of satoshis for each inscription output
- **Sat number calculation**: Automatically calculates the expected sat number ranges for each inscription based on postage
- **Content type support**: Supports any content type including text, JSON, HTML, images, and binary data
- **Metadata support**: Each inscription can have its own metadata
- **Fee optimization**: More efficient than multiple individual transactions

## Usage

```typescript
import { 
  prepareBatchCommitTransaction, 
  BatchCommitTransactionParams,
  BatchInscriptionParams 
} from 'ordinalsplus';

// Define your inscriptions
const inscriptions: BatchInscriptionParams[] = [
  {
    content: 'Hello, World! #1',
    contentType: 'text/plain',
    postage: 1000, // 1000 satoshis for this inscription
    metadata: { name: 'First Inscription', number: '1' }
  },
  {
    content: JSON.stringify({ message: 'Hello from JSON', id: 2 }),
    contentType: 'application/json',
    postage: 2000, // 2000 satoshis for this inscription
    metadata: { name: 'JSON Inscription', number: '2' }
  },
  {
    content: new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]), // "Hello" in bytes
    contentType: 'application/octet-stream',
    postage: 1500, // 1500 satoshis for this inscription
    metadata: { name: 'Binary Inscription', number: '3' }
  }
];

// Your UTXOs and other transaction parameters
const utxos = [
  {
    txid: 'your_utxo_txid_here',
    vout: 0,
    value: 50000,
    scriptPubKey: 'your_script_pubkey_here'
  }
  // ... more UTXOs as needed
];

const params: BatchCommitTransactionParams = {
  inscriptions,
  utxos,
  changeAddress: 'your_change_address_here',
  feeRate: 2, // sats/vB
  network: 'mainnet' // or 'testnet', 'signet'
};

// Prepare the batch commit transaction
const result = await prepareBatchCommitTransaction(params);

console.log(`Created batch with ${result.inscriptions.length} inscriptions`);
console.log(`Total commit amount: ${result.totalCommitAmount} sats`);
console.log(`Estimated fee: ${result.fees.commit} sats`);

// Each inscription result contains:
result.inscriptions.forEach((inscription, index) => {
  console.log(`Inscription ${index}:`);
  console.log(`  - Commit Address: ${inscription.commitAddress}`);
  console.log(`  - Postage: ${inscription.postage} sats`);
  console.log(`  - Sat Range: ${inscription.expectedSatRange.start} - ${inscription.expectedSatRange.end}`);
});

// The PSBT is ready to be signed and broadcast
console.log(`PSBT: ${result.commitPsbtBase64}`);
```

## Parameters

### BatchInscriptionParams

Each inscription in the batch requires:

- **content**: `Uint8Array | string` - The content to inscribe
- **contentType**: `string` (optional) - MIME type (e.g., 'text/plain', 'application/json')
- **filename**: `string` (optional) - Used to guess content type if contentType not provided
- **metadata**: `Record<string, string>` (optional) - Additional metadata
- **postage**: `number` - Amount of satoshis to allocate for this inscription (must be ≥ 546)

### BatchCommitTransactionParams

- **inscriptions**: `BatchInscriptionParams[]` - Array of inscription parameters
- **utxos**: `Utxo[]` - Available UTXOs to fund the transaction
- **changeAddress**: `string` - Address to send change back to
- **feeRate**: `number` - Fee rate in sats/vB
- **network**: `BitcoinNetwork` - 'mainnet', 'testnet', or 'signet'
- **recoveryPublicKey**: `Uint8Array` (optional) - Recovery public key for all commit addresses

## Result

The function returns a `BatchCommitTransactionResult` containing:

- **inscriptions**: Array of inscription results with commit addresses and sat ranges
- **commitPsbtBase64**: Base64-encoded PSBT ready for signing
- **commitPsbt**: Raw PSBT object for direct manipulation
- **totalCommitAmount**: Total amount required for all commit outputs
- **selectedUtxos**: UTXOs selected for the transaction
- **fees**: Fee information
- **transactionId**: Transaction ID in the tracker (optional)

## Sat Number Calculation

The batch commit transaction automatically calculates expected sat number ranges for each inscription based on the postage amounts. The sat ranges are sequential:

- Inscription 0: sats 0 to (postage[0] - 1)
- Inscription 1: sats postage[0] to (postage[0] + postage[1] - 1)
- Inscription 2: sats (postage[0] + postage[1]) to (postage[0] + postage[1] + postage[2] - 1)
- And so on...

These sat numbers can be used in the metadata of each inscription to reference the specific satoshis that will contain the inscription.

## Best Practices

1. **Postage amounts**: Use at least 546 satoshis (dust limit) for each inscription
2. **Fee estimation**: Higher fee rates may be needed during high network congestion
3. **UTXO management**: Ensure you have sufficient UTXOs to cover all postage amounts plus fees
4. **Batch size**: While there's no hard limit, very large batches may hit transaction size limits
5. **Content preparation**: Prepare all content and metadata before calling the function
6. **Error handling**: Always wrap calls in try-catch blocks to handle insufficient funds or other errors

## Error Handling

The function validates inputs and throws descriptive errors for:
- Empty inscriptions array
- Postage amounts below dust limit (546 sats)
- Missing UTXOs or change address
- Invalid fee rates
- Insufficient funds

## Integration with Reveal Transactions

After the batch commit transaction is confirmed, you can create individual reveal transactions for each inscription using their respective commit addresses and inscription scripts from the result.

## Example: Creating a Collection

```typescript
// Create a batch of NFT inscriptions for a collection
const collectionInscriptions = [];

for (let i = 1; i <= 100; i++) {
  collectionInscriptions.push({
    content: JSON.stringify({
      name: `Collection Item #${i}`,
      description: `Item ${i} of the collection`,
      image: `https://example.com/images/${i}.png`,
      attributes: [
        { trait_type: "Number", value: i },
        { trait_type: "Rarity", value: i <= 10 ? "Rare" : "Common" }
      ]
    }),
    contentType: 'application/json',
    postage: 1000,
    metadata: { 
      collection: 'MyCollection',
      item: i.toString(),
      rarity: i <= 10 ? 'rare' : 'common'
    }
  });
}

const batchResult = await prepareBatchCommitTransaction({
  inscriptions: collectionInscriptions,
  utxos: myUtxos,
  changeAddress: myChangeAddress,
  feeRate: 3,
  network: 'mainnet'
});

console.log(`Created collection batch with ${batchResult.inscriptions.length} items`);
```

This creates 100 NFT inscriptions in a single commit transaction, which is much more efficient than creating 100 separate transactions.