# Ordinals Plus Indexer

A scalable indexer for Ordinals Plus resources (DIDs and Verifiable Credentials) that works with both local ord nodes and the Ordiscan API.

## Features

- **Multi-Provider Support**: Works with local ord nodes or Ordiscan API
- **Network Support**: Mainnet, Signet, and Testnet
- **Scalable Architecture**: Redis-based storage with cursor-based batching
- **Resource Classification**: Automatically identifies and categorizes Ordinals Plus vs regular inscriptions
- **Error Handling**: Robust error tracking and recovery

## Configuration

The indexer is configured via environment variables:

### Required Configuration

```bash
# Network (required)
export NETWORK=mainnet              # 'mainnet', 'signet', or 'testnet'

# Provider Type (required)
export PROVIDER_TYPE=ordiscan       # 'ordiscan' or 'ord-node'

# Redis (required)
export REDIS_URL=redis://localhost:6379
```

### Provider-Specific Configuration

#### For Ordiscan Provider (Recommended for Mainnet)
```bash
export PROVIDER_TYPE=ordiscan
export ORDISCAN_API_KEY=your_api_key_here  # Get from ordiscan.com
```

#### For Local Ord Node Provider
```bash
export PROVIDER_TYPE=ord-node
export INDEXER_URL=http://localhost:80     # Your local ord server URL
```

### Optional Performance Settings

```bash
export POLL_INTERVAL=30000          # Poll interval in ms (30s for mainnet, 5s for signet)
export BATCH_SIZE=50               # Inscriptions per batch (50 for mainnet, 100 for signet)
export START_INSCRIPTION=0        # Starting inscription number
export WORKER_ID=mainnet-worker-1  # Worker identifier
```

## Quick Start Examples

### Mainnet with Ordiscan (Recommended)

```bash
# Set environment variables
export NETWORK=mainnet
export PROVIDER_TYPE=ordiscan
export ORDISCAN_API_KEY=your_ordiscan_api_key
export REDIS_URL=redis://localhost:6379
export POLL_INTERVAL=30000
export BATCH_SIZE=50

# Start the indexer
cd packages/ordinals-plus-indexer
bun run start
```

### Signet with Local Ord Node

```bash
# Set environment variables
export NETWORK=signet
export PROVIDER_TYPE=ord-node
export INDEXER_URL=http://localhost:80
export REDIS_URL=redis://localhost:6379
export POLL_INTERVAL=5000
export BATCH_SIZE=100

# Start the indexer
cd packages/ordinals-plus-indexer
bun run start
```

## Available Commands

### Start the Indexer
```bash
bun run start
```

### Check Statistics
```bash
bun run cli stats
```

### Manual Processing (Single Inscription)
```bash
bun run src/manual-index.ts
```

### Run Diagnostics
```bash
bun run src/diagnostic.ts
```

## Getting an Ordiscan API Key

1. Visit [ordiscan.com](https://ordiscan.com)
2. Sign up for an account
3. Navigate to API settings
4. Generate an API key
5. Set it as `ORDISCAN_API_KEY` environment variable

## Performance Recommendations

### Mainnet
- Use Ordiscan provider for better reliability
- Set `POLL_INTERVAL=30000` (30 seconds)
- Set `BATCH_SIZE=50` for conservative API usage
- Consider starting from a recent inscription number for faster catch-up

### Signet/Testnet
- Can use either provider
- Set `POLL_INTERVAL=5000` (5 seconds)
- Set `BATCH_SIZE=100` for faster processing

## Storage

The indexer stores data in Redis with the following structure:

- **Ordinals Plus Resources**: `ordinals-plus-resources` list
- **Non-Ordinals Resources**: `non-ordinals-resources` list
- **Resource Details**: `ordinals_plus:resource:{inscriptionId}` and `non_ordinals:resource:{inscriptionId}` hashes
- **Statistics**: Various `*:stats:*` keys
- **Cursor**: `indexer:cursor` tracks progress
- **Errors**: `indexer:error:{inscriptionNumber}` for failed inscriptions

## Troubleshooting

### Common Issues

1. **Missing API Key**: Set `ORDISCAN_API_KEY` when using ordiscan provider
2. **Redis Connection**: Ensure Redis is running and accessible
3. **Rate Limiting**: Increase `POLL_INTERVAL` if hitting API limits
4. **Memory Usage**: Monitor Redis memory usage for large datasets

### Monitoring

Check indexer statistics:
```bash
bun run cli stats
```

Run diagnostics on specific inscription:
```bash
INSCRIPTION_NUMBER=123456 bun run src/diagnostic.ts
```

## Architecture

The indexer consists of:

- **ResourceAnalyzer**: Classifies inscriptions as Ordinals Plus or regular
- **ResourceStorage**: Manages Redis storage and cursors
- **ScalableIndexerWorker**: Main worker loop with batch processing
- **Provider**: Abstracts ord node or Ordiscan API access

## Contributing

1. Ensure tests pass: `bun test`
2. Follow the existing code style
3. Add tests for new functionality
4. Update documentation as needed
