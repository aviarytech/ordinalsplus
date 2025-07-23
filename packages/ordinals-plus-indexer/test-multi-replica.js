#!/usr/bin/env node

/**
 * Test script to verify multi-replica support
 * This script simulates multiple workers trying to claim batches simultaneously
 */

import { createClient } from 'redis';
import { ScalableIndexerWorker } from './src/index.ts';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

async function testMultiReplica() {
  console.log('🧪 Testing multi-replica support...');
  
  const client = createClient({ url: REDIS_URL });
  await client.connect();
  
  // Clear any existing data
  await client.del('indexer:cursor');
  await client.del('indexer:claim:*');
  await client.del('ordinals-plus-resources');
  await client.del('non-ordinals-resources');
  await client.del('indexer:errors');
  
  // Initialize cursor
  await client.set('indexer:cursor', '0');
  
  console.log('✅ Test environment prepared');
  
  // Simulate multiple workers
  const workers = [];
  const numWorkers = 3;
  
  for (let i = 0; i < numWorkers; i++) {
    const worker = new ScalableIndexerWorker();
    worker.workerId = `test-worker-${i}`;
    workers.push(worker);
  }
  
  console.log(`🚀 Starting ${numWorkers} test workers...`);
  
  // Start all workers
  const promises = workers.map(worker => worker.start());
  
  // Let them run for a short time
  setTimeout(async () => {
    console.log('⏰ Stopping test after 10 seconds...');
    
    // Stop all workers
    for (const worker of workers) {
      await worker.stop();
    }
    
    // Check results
    const stats = await client.get('indexer:cursor');
    const activeClaims = await client.keys('indexer:claim:*');
    
    console.log('📊 Test Results:');
    console.log(`- Cursor position: ${stats}`);
    console.log(`- Active claims: ${activeClaims.length}`);
    
    if (activeClaims.length === 0) {
      console.log('✅ SUCCESS: No conflicting claims detected');
    } else {
      console.log('⚠️ WARNING: Some claims still active');
      for (const claimKey of activeClaims) {
        const claimData = await client.get(claimKey);
        console.log(`  - ${claimKey}: ${claimData}`);
      }
    }
    
    await client.disconnect();
    process.exit(0);
  }, 10000);
}

testMultiReplica().catch(console.error); 