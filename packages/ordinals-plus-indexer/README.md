# Ordinals Plus Indexer

A scalable indexer for Ordinals Plus resources that supports multiple replicas working in parallel.

## Features

- **Multi-replica support**: Multiple indexer instances can run simultaneously without conflicts
- **Atomic batch claiming**: Uses Redis Lua scripts to ensure only one worker claims each batch
- **Automatic cursor management**: Tracks progress and handles missing inscriptions gracefully
- **Resource classification**: Distinguishes between Ordinals Plus and non-Ordinals Plus resources
- **Error handling**: Robust error handling with detailed logging
- **Monitoring**: Built-in statistics and monitoring capabilities

## Multi-Replica Architecture

The indexer uses a Redis-based coordination system to ensure multiple replicas can work together:

### Batch Claiming
- Each worker claims a unique batch of inscriptions to process
- Uses atomic Redis operations to prevent race conditions
- Claims expire automatically after 1 hour to handle worker failures

### Cursor Management
- Global cursor tracks the highest processed inscription number
- Workers only advance the cursor after successfully processing their batch
- Handles missing inscriptions by stopping at the first gap

### Worker Coordination
- Workers can see each other's active claims
- Automatic cleanup of expired claims
- Graceful shutdown releases worker claims

## Environment Variables

```bash
# Required
REDIS_URL=redis://localhost:6379
INDEXER_URL=http://localhost:80  # or Ordiscan API

# Optional
WORKER_ID=worker-1               # Unique ID for each replica (auto-generated if not set)
POLL_INTERVAL=5000               # Milliseconds between polls
BATCH_SIZE=100                   # Inscriptions per batch
START_INSCRIPTION=0              # Starting inscription number
NETWORK=mainnet                  # mainnet, signet, testnet
PROVIDER_TYPE=ord-node           # ord-node or ordiscan
ORDISCAN_API_KEY=your_key        # Required for ordiscan provider
```

## Running Multiple Replicas

The indexer automatically generates unique worker IDs using process ID, timestamp, and random components. You can run multiple replicas without any configuration:

```bash
# Terminal 1
npm start

# Terminal 2  
npm start

# Terminal 3
npm start
```

Each worker will have a unique ID like `worker-12345-1703123456789-4567`.

**Manual Worker IDs**: You can still set `WORKER_ID` environment variable for easier identification:

```bash
# For easier monitoring
WORKER_ID=worker-1 npm start
WORKER_ID=worker-2 npm start
WORKER_ID=worker-3 npm start
```

2. **Monitor active workers**:
   ```bash
   # Check Redis for active claims
   redis-cli keys "indexer:claim:*"
   
   # Get detailed stats
   redis-cli get "indexer:cursor"
   ```

3. **Test multi-replica support**:
   ```bash
   node test-multi-replica.js
   ```

## Monitoring

The indexer provides comprehensive monitoring:

- **Global stats**: Total resources, errors, cursor position
- **Active workers**: Number of currently running replicas
- **Batch progress**: Real-time batch processing status
- **Error tracking**: Detailed error logs with worker attribution

## Scaling Considerations

- **Redis performance**: Ensure Redis can handle the connection load
- **Network bandwidth**: Multiple replicas increase API calls to the provider
- **Batch size**: Adjust based on processing speed and memory usage
- **Worker count**: Monitor Redis memory usage with many active workers

## Troubleshooting

### Workers claiming the same batches
- Check Redis connectivity
- Verify unique WORKER_ID values
- Check for expired claims that weren't cleaned up

### High failure rates
- Adjust POLL_INTERVAL to wait longer for new inscriptions
- Check provider API limits and rate limiting
- Verify network configuration

### Memory issues
- Reduce BATCH_SIZE
- Monitor Redis memory usage
- Check for memory leaks in long-running workers

