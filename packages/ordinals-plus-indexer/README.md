# Ordinals Plus Indexer

A simple, efficient indexer for crawling Bitcoin inscriptions and identifying Ordinals Plus resources (DID documents and Verifiable Credentials).

## Overview

This indexer uses a **cursor-based approach** for simple and reliable coordination between multiple workers. It automatically detects network-specific DID formats and handles end-of-inscription scenarios gracefully.

## Features

✅ **Simple cursor coordination** - no complex range tracking  
✅ **Easy resumption** - always picks up from the global cursor  
✅ **Network-aware DIDs** - mainnet: `did:btco:123/0`, signet: `did:btco:sig:123/0`  
✅ **Smart backoff** - detects end of inscriptions and backs off gracefully  
✅ **Horizontally scalable** - run multiple workers safely  
✅ **Two resource lists** - Ordinals Plus and Non-Ordinals Plus  
✅ **Chronological ordering** - both resource types sorted by inscription number  

## Quick Start

### Prerequisites

- Node.js/Bun
- Redis server running
- Ord server running (for inscription data)

### Installation

```bash
cd packages/ordinals-plus-indexer
bun install
```

### Running

```bash
# Start indexer on mainnet
bun run cli start

# Start indexer on signet  
NETWORK=signet bun run cli start

# Start from specific inscription number
START_INSCRIPTION=10000 NETWORK=signet bun run cli start
```

### Monitoring

Check indexer status:
```bash
./status.sh

# Or use CLI commands
bun run cli stats        # Show detailed statistics
bun run cli errors       # Show recent processing errors
bun run cli errors 25    # Show last 25 errors
```

## Configuration

Set via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `INDEXER_URL` | Ord server URL | `http://localhost:80` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `NETWORK` | Bitcoin network (`mainnet`\|`signet`\|`testnet`) | `mainnet` |
| `POLL_INTERVAL` | Polling interval in ms | `30000` |
| `BATCH_SIZE` | Inscriptions per batch | `100` |
| `START_INSCRIPTION` | Starting inscription number | `0` |
| `WORKER_ID` | Unique worker identifier | `worker-<timestamp>` |

## Architecture

### Cursor-Based Coordination

Instead of complex range tracking, the indexer uses a simple cursor system:

1. **Global Cursor** (`indexer:cursor`) - tracks highest processed inscription
2. **Atomic Claims** - workers atomically claim the next batch from cursor
3. **Simple Resumption** - just read cursor and continue from there
4. **Clean Backoff** - single timestamp for when to resume after failures

### DID Format by Network

- **Mainnet**: `did:btco:123123123/0`
- **Signet**: `did:btco:sig:123123123/0`  
- **Testnet**: `did:btco:test:123123123/0`

### Smart Failure Handling

When 80%+ of inscriptions in a batch fail (indicating end of available inscriptions):

1. Increment consecutive failure counter
2. After 50 consecutive failures, enter exponential backoff
3. Backoff delays: 30s → 60s → 120s → 240s → 300s (max)
4. Resume checking periodically for new inscriptions

### Redis Keys

| Key | Purpose |
|-----|---------|
| `indexer:cursor` | Current highest processed inscription number |
| `indexer:consecutive_failures` | Count of consecutive failed batches |
| `indexer:backoff_until` | Timestamp when to resume (if backing off) |
| `ordinals-plus-resources` | List of Ordinals Plus resource IDs |
| `non-ordinals-resources` | List of Non-Ordinals Plus resource IDs |
| `indexer:errors` | List of inscription IDs that failed processing |
| `indexer:error:<number>` | Error details for specific inscription number |
| `ordinals-plus:stats:*` | Counters for Ordinals Plus resources |
| `non-ordinals:stats:*` | Counters for Non-Ordinals resources |
| `indexer:stats:errors` | Total count of processing errors |

## Multiple Workers

Run multiple workers for faster processing:

```bash
# Terminal 1
WORKER_ID=worker-1 NETWORK=signet bun run cli start

# Terminal 2  
WORKER_ID=worker-2 NETWORK=signet bun run cli start

# Terminal 3
WORKER_ID=worker-3 NETWORK=signet bun run cli start
```

Each worker safely claims the next available batch using Redis atomic operations.

## Resumption

The indexer automatically resumes from where it left off:

1. **Clean shutdown**: Cursor shows last completed inscription
2. **Restart**: Indexer reads cursor and continues from next inscription
3. **Reset**: `redis-cli set indexer:cursor 0` to start over

## Resource Detection

The indexer identifies **Ordinals Plus resources** by checking inscription metadata:

### DID Documents
```json
{
  "id": "did:btco:sig:123123123/0",
  "verificationMethod": [...]
}
```

### Verifiable Credentials  
```json
{
  "type": ["VerifiableCredential"],
  "credentialSubject": {...}
}
```

All other inscriptions are classified as **Non-Ordinals Plus resources**.

## Error Handling

When inscriptions fail to process (e.g., missing satoshi numbers, API failures), they are stored in an error list for later analysis:

### Viewing Errors
```bash
# Show recent errors via CLI
bun run cli errors

# Show error details via Redis
redis-cli hgetall indexer:error:<inscription-number>

# List all error inscription IDs  
redis-cli lrange indexer:errors 0 -1
```

### Common Error Types
- **Missing satoshi number** - inscription details returned null `sat` property
- **Invalid sat info** - satoshi info missing or malformed `inscription_ids`
- **API failures** - network timeouts or server errors

Errors are stored with full context (inscription ID, number, error message, timestamp, worker ID) for debugging and potential reprocessing.

## API Integration

The indexed resources can be queried via the Ordinals Plus API:

```bash
# Get Ordinals Plus resources
curl http://localhost:3001/api/indexer/ordinals-plus

# Get Non-Ordinals resources  
curl http://localhost:3001/api/indexer/non-ordinals

# Get indexer stats
curl http://localhost:3001/api/indexer/stats
```

## Troubleshooting

### "No work available" message
- Check if indexer reached end of inscriptions: `./status.sh`
- If in backoff mode, wait for backoff period to expire
- Check if Redis contains cursor: `redis-cli get indexer:cursor`

### Reset indexer
```bash
# Reset to start from beginning
redis-cli set indexer:cursor 0
redis-cli del indexer:consecutive_failures  
redis-cli del indexer:backoff_until
```

### Check specific inscription
```bash
# Test if inscription exists in ord server
curl http://localhost:80/r/inscription/<inscription-number>
```

## License

MIT
