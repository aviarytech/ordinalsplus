#!/usr/bin/env node

import { ScalableIndexerWorker, ResourceStorage } from './index.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Simple CLI for the Resource Indexer
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  switch (command) {
    case 'start':
      console.log('🚀 Starting Resource Indexer Worker...');
      const worker = new ScalableIndexerWorker();
      await worker.start();
      break;

    case 'stats':
      console.log('📊 Getting indexer statistics...');
      const storage = new ResourceStorage(REDIS_URL);
      await storage.connect();
      
      const stats = await storage.getStats();
      
      console.log('\n📊 Indexer Statistics:');
      console.log(`   Cursor position: ${stats.cursor}`);
      console.log(`   Active workers: ${stats.activeWorkers}`);
      console.log('\n📋 Ordinals Plus Resources:');
      console.log(`   Total: ${stats.ordinalsPlus.total}`);
      console.log(`   DID Documents: ${stats.ordinalsPlus.didDocuments}`);
      console.log(`   Verifiable Credentials: ${stats.ordinalsPlus.verifiableCredentials}`);
      console.log('\n📋 Non-Ordinals Resources:');
      console.log(`   Total: ${stats.nonOrdinals.total}`);
      
      // Show content type breakdown
      for (const [type, count] of Object.entries(stats.nonOrdinals)) {
        if (type !== 'total') {
          console.log(`   ${type}: ${count}`);
        }
      }
      
      console.log('\n❌ Processing Errors:');
      console.log(`   Total: ${stats.errors.total}`);
      
      await storage.disconnect();
      break;

    case 'errors':
      console.log('❌ Getting recent errors...');
      const errorStorage = new ResourceStorage(REDIS_URL);
      await errorStorage.connect();
      
      const limit = parseInt(args[1]) || 10;
      const errorIds = await errorStorage.getInscriptionErrors(limit);
      
      console.log(`\n❌ Recent ${errorIds.length} errors:`);
      for (const errorId of errorIds) {
        const details = await errorStorage.getErrorDetails(errorId);
        if (details) {
          const date = new Date(details.timestamp).toISOString();
          console.log(`   ${errorId} (#${details.inscriptionNumber}) - ${details.error}`);
          console.log(`      Worker: ${details.workerId}, Time: ${date}`);
        }
      }
      
      await errorStorage.disconnect();
      break;
      
    case 'help':
    case '--help':
    case '-h':
      console.log(`
Resource Indexer CLI

Usage:
  ordinals-indexer [command]

Commands:
  start     Start an indexer worker (default)
  stats     Show indexer statistics
  errors    Show recent processing errors (optional: limit count)
  help      Show this help message

Environment Variables:
  INDEXER_URL       Ord server URL (default: http://localhost:80)
  REDIS_URL         Redis URL (default: redis://localhost:6379)  
  NETWORK           Bitcoin network: mainnet|signet|testnet (default: mainnet)
  POLL_INTERVAL     Polling interval in ms (default: 30000)
  BATCH_SIZE        Work range size per worker (default: 100)
  WORKER_ID         Unique worker identifier (auto-generated if not set)
  START_INSCRIPTION Starting inscription number (default: 0)

Features:
  ✅ Multi-replica support - Run multiple workers simultaneously
  ✅ Atomic batch claiming - No race conditions between workers
  ✅ Two Resource Lists - Ordinals Plus and Non-Ordinals Plus
  ✅ Network-aware DIDs - mainnet: did:btco:123/0, signet: did:btco:sig:123/0
  ✅ Smart backoff - detects end of inscriptions and backs off gracefully
  ✅ Simple cursor-based coordination - no complex range tracking
  ✅ Easy resumption - always picks up from the global cursor
  ✅ Horizontally scalable - run multiple workers safely
  ✅ Chronological ordering - both resource types sorted by inscription number

Redis Keys Created:
  📋 ordinals-plus-resources     - Single list of Ordinals Plus resource IDs
  📋 non-ordinals-resources      - Single list of Non-Ordinals Plus resource IDs
  ❌ indexer:errors              - List of inscription IDs that failed processing
  📍 indexer:cursor              - Current highest processed inscription number
  🔒 indexer:claim:*             - Active worker batch claims
  
Examples:
  # Start a worker on mainnet
  bun run cli start
  
  # Start a worker on signet
  NETWORK=signet bun run cli start
  
  # Start multiple workers (different terminals)
  WORKER_ID=worker-1 bun run cli start
  WORKER_ID=worker-2 bun run cli start
  WORKER_ID=worker-3 bun run cli start
  
  # Start from a specific inscription number
  START_INSCRIPTION=10000 bun run cli start
  
  # Check indexer statistics
  bun run cli stats
  
  # View recent errors (default: 10)
  bun run cli errors
  
  # View more errors
  bun run cli errors 25
      `);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Run "ordinals-indexer help" for usage information.');
      process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('💥 CLI failed:', err);
    process.exit(1);
  });
} 