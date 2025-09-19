import { OrdNodeProvider, OrdiscanProvider } from 'ordinalsplus';
import { createClient } from 'redis';
import type { BitcoinNetwork } from 'ordinalsplus';

const INDEXER_URL = process.env.INDEXER_URL ?? 'http://localhost:80';
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const NETWORK = (process.env.NETWORK || 'mainnet') as BitcoinNetwork;
const WORKER_ID = `manual-worker-${Date.now()}`;

// Provider configuration (same as main indexer)
const PROVIDER_TYPE = process.env.PROVIDER_TYPE || 'ordiscan'; // 'ordiscan' or 'ord-node'
const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY || '';

interface OrdinalsResource {
  resourceId: string;
  inscriptionId: string;
  inscriptionNumber: number;
  ordinalsType: 'did-document' | 'verifiable-credential';
  contentType: string;
  metadata: any;
  indexedAt: number;
}

interface NonOrdinalsResource {
  resourceId: string;
  inscriptionId: string;
  inscriptionNumber: number;
  contentType: string;
  indexedAt: number;
}

interface InscriptionError {
  inscriptionId: string;
  inscriptionNumber: number;
  error: string;
  timestamp: number;
  workerId: string;
}

class ManualIndexer {
  private provider: OrdNodeProvider | OrdiscanProvider;
  private redis: any;

  constructor() {
    console.log(`🔧 Using provider: ${PROVIDER_TYPE} on ${NETWORK}`);
    
    if (PROVIDER_TYPE === 'ord-node') {
      const providerOptions = {
        nodeUrl: INDEXER_URL,
        network: NETWORK
      };
      this.provider = new OrdNodeProvider(providerOptions);
    } else if (PROVIDER_TYPE === 'ordiscan') {
      if (!ORDISCAN_API_KEY) {
        throw new Error('ORDISCAN_API_KEY environment variable is required when using ordiscan provider');
      }
      this.provider = new OrdiscanProvider({ 
        apiKey: ORDISCAN_API_KEY,
        network: NETWORK,
        timeout: 10000
      });
    } else {
      throw new Error(`Unknown provider type: ${PROVIDER_TYPE}`);
    }
    this.redis = createClient({ url: REDIS_URL });
  }

  async connect() {
    await this.redis.connect();
    console.log('✅ Connected to Redis');
  }

  async disconnect() {
    await this.redis.disconnect();
  }

  private isOrdinalsPlus(metadata: any): boolean {
    if (!metadata) return false;
    
    // Check for DID documents
    if (metadata?.id?.startsWith('did:btco:') && metadata.verificationMethod) {
      return true;
    }
    
    // Check for Verifiable Credentials
    if (metadata?.type?.includes?.('VerifiableCredential') || metadata?.credentialSubject) {
      return true;
    }
    
    return false;
  }

  private getOrdinalsType(metadata: any): 'did-document' | 'verifiable-credential' {
    if (metadata?.id?.startsWith('did:btco:') && metadata.verificationMethod) {
      return 'did-document';
    }
    return 'verifiable-credential';
  }

  private async generateResourceId(inscriptionId: string, inscriptionNumber: number): Promise<string> {
    try {
      // Get the inscription details to find its satoshi number
      const inscriptionDetails = await this.provider.getInscription(inscriptionId);
      
      if (!inscriptionDetails || typeof inscriptionDetails.sat !== 'number') {
        throw new Error(`Inscription details missing or invalid sat number: ${JSON.stringify(inscriptionDetails)}`);
      }
      
      const satNumber = inscriptionDetails.sat;
      
      // Get all inscriptions on that satoshi
      const satInfo = await this.provider.getSatInfo(satNumber.toString());
      
      if (!satInfo || !Array.isArray(satInfo.inscription_ids)) {
        throw new Error(`Sat info missing or invalid inscription_ids: ${JSON.stringify(satInfo)}`);
      }
      
      const inscriptionsOnSat = satInfo.inscription_ids;
      
      // Find the index of our inscription on this satoshi
      const inscriptionIndex = inscriptionsOnSat.indexOf(inscriptionId);
      
      if (inscriptionIndex === -1) {
        console.warn(`Warning: Inscription ${inscriptionId} not found in sat ${satNumber} inscription list. Using index 0.`);
        return this.formatDid(satNumber, 0);
      }
      
      return this.formatDid(satNumber, inscriptionIndex);
    } catch (error) {
      throw new Error(`Error generating resource ID for inscription ${inscriptionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private formatDid(satNumber: number, index: number): string {
    const networkPrefix = NETWORK === 'signet' ? 'sig:' : NETWORK === 'testnet' ? 'test:' : '';
    return `did:btco:${networkPrefix}${satNumber}/${index}`;
  }

  private extractNetworkFromResourceId(resourceId: string): string {
    const match = resourceId.match(/did:btco:(?:(sig):)?/);
    return match && match[1] ? 'signet' : 'mainnet';
  }

  async processInscription(inscriptionNumber: number): Promise<void> {
    console.log(`🔍 Processing inscription #${inscriptionNumber}...`);
    
    try {
      // Get inscription details
      const inscription = await this.provider.getInscriptionByNumber(inscriptionNumber);
      console.log(`📄 Found inscription: ${inscription.id}`);
      console.log(`📄 Content Type: ${inscription.content_type}`);
      console.log(`📄 Satoshi: ${inscription.sat}`);
      
      // Try to get metadata
      const metadata = await this.provider.getMetadata(inscription.id);
      
      if (metadata) {
        console.log(`📊 Found CBOR metadata:`, JSON.stringify(metadata, null, 2));
      } else {
        console.log(`📊 No CBOR metadata found`);
      }
      
      // Generate resource ID
      const resourceId = await this.generateResourceId(inscription.id, inscriptionNumber);
      console.log(`�� Generated resource ID: ${resourceId}`);
      
      // Check if this is an Ordinals Plus resource
      if (metadata && this.isOrdinalsPlus(metadata)) {
        const ordinalsResource: OrdinalsResource = {
          resourceId,
          inscriptionId: inscription.id,
          inscriptionNumber,
          ordinalsType: this.getOrdinalsType(metadata),
          contentType: inscription.content_type || 'application/json',
          metadata,
          indexedAt: Date.now()
        };
        
        // Store in Redis
        await this.storeOrdinalsResource(ordinalsResource);
        console.log(`✅ Stored as Ordinals Plus resource: ${ordinalsResource.ordinalsType}`);
        
      } else {
        const nonOrdinalsResource: NonOrdinalsResource = {
          resourceId,
          inscriptionId: inscription.id,
          inscriptionNumber,
          contentType: inscription.content_type || 'unknown',
          indexedAt: Date.now()
        };
        
        // Store in Redis
        await this.storeNonOrdinalsResource(nonOrdinalsResource);
        console.log(`📝 Stored as Non-Ordinals resource`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing inscription #${inscriptionNumber}:`, error);
      
      const inscriptionError: InscriptionError = {
        inscriptionId: `error-${inscriptionNumber}`,
        inscriptionNumber,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        workerId: WORKER_ID
      };
      
      await this.storeInscriptionError(inscriptionError);
    }
  }

  private async storeOrdinalsResource(resource: OrdinalsResource): Promise<void> {
    // Store in list for chronological ordering
    await this.redis.sAdd('ordinals-plus-resources', resource.resourceId);
    
    // Store detailed resource data in a hash
    const resourceKey = `ordinals_plus:resource:${resource.inscriptionId}`;
    await this.redis.hSet(resourceKey, {
      inscriptionId: resource.inscriptionId,
      inscriptionNumber: resource.inscriptionNumber.toString(),
      resourceId: resource.resourceId,
      ordinalsType: resource.ordinalsType,
      contentType: resource.contentType,
      indexedAt: resource.indexedAt.toString(),
      indexedBy: 'manual-indexer',
      network: this.extractNetworkFromResourceId(resource.resourceId)
    });
    
    // Update stats
    await this.redis.incr(`ordinals-plus:stats:${resource.ordinalsType}`);
    await this.redis.incr('ordinals-plus:stats:total');
  }

  private async storeNonOrdinalsResource(resource: NonOrdinalsResource): Promise<void> {
    // Store in list for chronological ordering
    await this.redis.lPush('non-ordinals-resources', resource.resourceId);
    
    // Store detailed resource data in a hash
    const resourceKey = `non_ordinals:resource:${resource.inscriptionId}`;
    await this.redis.hSet(resourceKey, {
      inscriptionId: resource.inscriptionId,
      inscriptionNumber: resource.inscriptionNumber.toString(),
      resourceId: resource.resourceId,
      contentType: resource.contentType,
      indexedAt: resource.indexedAt.toString(),
      indexedBy: 'manual-indexer',
      network: this.extractNetworkFromResourceId(resource.resourceId)
    });
    
    // Update stats
    await this.redis.incr('non-ordinals:stats:total');
    const contentTypeKey = resource.contentType.split('/')[0] || 'unknown';
    await this.redis.incr(`non-ordinals:stats:${contentTypeKey}`);
  }

  private async storeInscriptionError(error: InscriptionError): Promise<void> {
    // const errorKey = `indexer:error:${error.inscriptionNumber}`;
    // await this.redis.hSet(errorKey, {
    //   inscriptionId: error.inscriptionId,
    //   inscriptionNumber: error.inscriptionNumber.toString(),
    //   error: error.error,
    //   timestamp: error.timestamp.toString(),
    //   workerId: error.workerId
    // });
    
    await this.redis.lPush('indexer:errors', error.inscriptionId);
    await this.redis.incr('indexer:stats:errors');
  }
}

async function main() {
  const inscriptionNumbers = process.argv.slice(2).map(num => parseInt(num));
  
  if (inscriptionNumbers.length === 0) {
    console.log('Usage: npx tsx src/manual-index.ts <inscription_number> [inscription_number2] ...');
    console.log('Example: npx tsx src/manual-index.ts 153426');
    process.exit(1);
  }
  
  const indexer = new ManualIndexer();
  
  try {
    await indexer.connect();
    
    for (const inscriptionNumber of inscriptionNumbers) {
      if (isNaN(inscriptionNumber)) {
        console.log(`❌ Invalid inscription number: ${inscriptionNumber}`);
        continue;
      }
      
      await indexer.processInscription(inscriptionNumber);
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Manual indexing failed:', error);
  } finally {
    await indexer.disconnect();
  }
}

// Run if called directly
if (process.argv[1].includes('manual-index.ts')) {
  main().catch(console.error);
}

export { ManualIndexer }; 