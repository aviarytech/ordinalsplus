import { createClient } from 'redis';

const REDIS_URL = process.env.REDIS_URL as string;
if (!REDIS_URL) {
  console.error('REDIS_URL is not set');
  process.exit(1);
}

async function resetIndex(): Promise<void> {
  const client = createClient({ url: REDIS_URL });
  client.on('error', (err: any) => console.error('Redis error:', err));
  await client.connect();

  const patterns: string[] = [
    'indexer:cursor',
    'indexer:stats:errors',
    'indexer:errors',
    'indexer:error:*',
    'indexer:claim:*',
    'ordinals-plus:stats:*',
    'non-ordinals:stats:*',
    'indexed:inscriptions',
    'ordinals-plus-resources',
    'non-ordinals-resources',
    'ordinals_plus:resource:*'
  ];

  let totalDeleted = 0;
  for (const pattern of patterns) {
    try {
      let keys: string[] = [];
      if (pattern.includes('*')) {
        keys = await client.keys(pattern);
      } else {
        keys = [pattern];
      }
      if (keys.length === 0) continue;
      const deleted = await client.del(keys);
      totalDeleted += deleted;
      console.log(`🗑️  Deleted ${deleted} key(s) for pattern '${pattern}'`);
    } catch (e) {
      console.warn(`⚠️  Failed deleting pattern '${pattern}':`, (e as any)?.message || e);
    }
  }

  await client.disconnect();
  console.log(`✅ Reset complete. Total keys deleted: ${totalDeleted}`);
}

resetIndex().catch(err => {
  console.error('Reset failed:', err);
  process.exit(1);
});


