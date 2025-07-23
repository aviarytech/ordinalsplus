import { OrdNodeProvider } from 'ordinalsplus';
import { OrdiscanProvider } from '../../ordinalsplus/src/resources/providers/ordiscan-provider';
import { createClient } from 'redis';
import { BitcoinNetwork } from '../../ordinalsplus/src/types';

const INDEXER_URL = process.env.INDEXER_URL ?? 'http://localhost:80';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const NETWORK = (process.env.NETWORK || 'mainnet') as BitcoinNetwork;

// Provider configuration (same as main indexer)
const PROVIDER_TYPE = process.env.PROVIDER_TYPE || 'ordiscan'; // 'ordiscan' or 'ord-node'
const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY || '';

async function checkInscriptionDiagnostics(inscriptionNumber: number) {
  console.log(`🔍 Diagnostic check for inscription #${inscriptionNumber}`);
  console.log(`Using provider: ${PROVIDER_TYPE}`);
  if (PROVIDER_TYPE === 'ord-node') {
    console.log(`Using indexer URL: ${INDEXER_URL}`);
  } else {
    console.log(`Using Ordiscan API`);
  }
  console.log(`Using Redis URL: ${REDIS_URL}`);
  console.log(`Network: ${NETWORK}`);
  console.log('');

  // Initialize provider based on type
  let provider: OrdNodeProvider | OrdiscanProvider;
  if (PROVIDER_TYPE === 'ord-node') {
    const providerOptions = {
      nodeUrl: INDEXER_URL,
      network: NETWORK
    };
    provider = new OrdNodeProvider(providerOptions);
  } else if (PROVIDER_TYPE === 'ordiscan') {
    if (!ORDISCAN_API_KEY) {
      throw new Error('ORDISCAN_API_KEY environment variable is required when using ordiscan provider');
    }
    provider = new OrdiscanProvider({ 
      apiKey: ORDISCAN_API_KEY,
      network: NETWORK,
      timeout: 10000
    });
  } else {
    throw new Error(`Unknown provider type: ${PROVIDER_TYPE}`);
  }

  const redis = createClient({ url: REDIS_URL });

  try {
    // Connect to Redis
    await redis.connect();
    console.log('✅ Connected to Redis');

    // 1. Check indexer cursor position
    const cursor = await redis.get('indexer:cursor');
    const currentCursor = parseInt(cursor || '0');
    console.log(`📍 Current indexer cursor: ${currentCursor}`);
    
    if (currentCursor < inscriptionNumber) {
      console.log(`⚠️ Indexer hasn't reached inscription #${inscriptionNumber} yet`);
      console.log(`   Need to process ${inscriptionNumber - currentCursor} more inscriptions`);
    } else {
      console.log(`✅ Indexer has processed inscription #${inscriptionNumber}`);
    }
    console.log('');

    // 2. Get inscription details from ord node
    try {
      console.log(`🔎 Fetching inscription #${inscriptionNumber} details...`);
      
      // Get inscription by number
      const inscription = await provider.getInscriptionByNumber(inscriptionNumber);
      const inscriptionId = inscription.id;
      
      console.log(`📄 Inscription ID: ${inscriptionId}`);
      console.log(`📄 Content Type: ${inscription.content_type || 'unknown'}`);
      console.log(`📄 Satoshi: ${inscription.sat || 'unknown'}`);
      console.log(`📄 Content URL: ${inscription.content_url || 'unknown'}`);
      console.log('');

      // 3. Get detailed inscription info
      const details = await provider.getInscription(inscriptionId);
      console.log(`📋 Inscription Details:`, JSON.stringify(details, null, 2));
      console.log('');

      // 4. Try to get metadata (CBOR)
      try {
        const metadata = await provider.getMetadata(inscriptionId);
        if (metadata) {
          console.log(`📊 CBOR Metadata:`, JSON.stringify(metadata, null, 2));
          
          // Check if it would qualify as Ordinals Plus
          const isDidDocument = metadata?.id?.startsWith('did:btco:') && metadata.verificationMethod;
          const isVC = metadata?.type?.includes?.('VerifiableCredential') || metadata?.credentialSubject;
          
          console.log(`🎯 Would qualify as Ordinals Plus: ${isDidDocument || isVC}`);
          if (isDidDocument) console.log(`   - Type: DID Document`);
          if (isVC) console.log(`   - Type: Verifiable Credential`);
          
        } else {
          console.log(`📊 No CBOR metadata found`);
          console.log(`🎯 Would qualify as Ordinals Plus: false (no metadata)`);
        }
      } catch (metadataError) {
        console.log(`⚠️ Could not fetch metadata: ${metadataError}`);
        console.log(`🎯 Would qualify as Ordinals Plus: false (metadata error)`);
      }
      console.log('');

      // 5. Check if inscription is in our Redis storage
      const ordinalsResourceKey = `ordinals_plus:resource:${inscriptionId}`;
      const nonOrdinalsResourceKey = `non_ordinals:resource:${inscriptionId}`;
      
      const ordinalsResource = await redis.hGetAll(ordinalsResourceKey);
      const nonOrdinalsResource = await redis.hGetAll(nonOrdinalsResourceKey);
      
      console.log(`🗄️ Storage Status:`);
      if (Object.keys(ordinalsResource).length > 0) {
        console.log(`   ✅ Found as Ordinals Plus resource:`, ordinalsResource);
      } else if (Object.keys(nonOrdinalsResource).length > 0) {
        console.log(`   📝 Found as Non-Ordinals resource:`, nonOrdinalsResource);
      } else {
        console.log(`   ❌ Not found in storage (not processed yet or error occurred)`);
      }
      console.log('');

      // 6. Check for errors
      const errorKeys = await redis.keys(`indexer:error:${inscriptionNumber}`);
      if (errorKeys.length > 0) {
        for (const errorKey of errorKeys) {
          const errorData = await redis.hGetAll(errorKey);
          console.log(`❌ Found error record:`, errorData);
        }
      } else {
        console.log(`✅ No error records found for inscription #${inscriptionNumber}`);
      }
      console.log('');

      // 7. General indexer stats
      const stats = {
        ordinalsTotal: await redis.get('ordinals-plus:stats:total') || '0',
        nonOrdinalsTotal: await redis.get('non-ordinals:stats:total') || '0',
        errorTotal: await redis.get('indexer:stats:errors') || '0',
        consecutiveFailures: await redis.get('indexer:consecutive_failures') || '0'
      };
      
      console.log(`📊 Indexer Stats:`);
      console.log(`   Ordinals Plus Resources: ${stats.ordinalsTotal}`);
      console.log(`   Non-Ordinals Resources: ${stats.nonOrdinalsTotal}`);
      console.log(`   Errors: ${stats.errorTotal}`);
      console.log(`   Consecutive Failures: ${stats.consecutiveFailures}`);

    } catch (error) {
      console.error(`❌ Error fetching inscription details: ${error}`);
    }

  } catch (error) {
    console.error(`❌ Diagnostic failed: ${error}`);
  } finally {
    await redis.disconnect();
  }
}

// Run diagnostic if script is called directly
if (process.argv[1].includes('diagnostic.ts')) {
  const inscriptionNumber = process.argv[2] ? parseInt(process.argv[2]) : 153426;
  checkInscriptionDiagnostics(inscriptionNumber).catch(console.error);
}

export { checkInscriptionDiagnostics }; 