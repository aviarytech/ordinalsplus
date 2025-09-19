/**
 * Resource Inscription Service
 * 
 * This service handles the inscription of resources linked to DIDs,
 * ensuring they are inscribed on the same satoshi as their parent DID.
 */
import { DIDService, DID_REGEX } from './didService';
import { VCService } from './vcService';
import { prepareResourceInscription as opPrepareResourceInscription } from 'ordinalsplus';
import { schnorr, secp256k1 } from '@noble/curves/secp256k1';
import { logger } from '../utils/logger';
import { env } from '../config/envConfig';
import type ApiService from './apiService';
import { DEFAULT_VALIDATION_RULES, ResourceType, type CreateResourceParams, type FeeConfig, type ResourceCreationOutput, type ResourceMetadata, type WalletConfig } from 'ordinalsplus';

// Environment variable for Ord node URL (default to localhost:80 if not set)
const ORD_NODE_URL = env.ORD_NODE_URL || 'http://127.0.0.1:80';

/**
 * Custom Error class for Resource Inscription errors
 */
export class ResourceInscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceInscriptionError';
  }
}

/**
 * Status of a resource inscription request
 */
export enum ResourceInscriptionStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Resource inscription request
 */
export interface ResourceInscriptionRequest {
  parentDid?: string;
  requesterDid?: string;
  /** Optional direct sat number target for inscription */
  satNumber?: number;
  content: Buffer;
  contentType: string;
  label: string;
  resourceType: string;
  feeRate?: number;
  metadata?: Record<string, any>;
}

/**
 * Resource inscription record
 */
export interface ResourceInscription {
  id: string;
  parentDid: string;
  requesterDid: string;
  label: string;
  resourceType: string;
  contentType: string;
  contentSize: number;
  status: ResourceInscriptionStatus;
  requestedAt: string;
  updatedAt: string;
  completedAt?: string;
  inscriptionId?: string;
  satoshi?: string;
  resourceIndex?: number;
  fees?: {
    feeRate: number;
    total: number;
    commit: number;
    reveal: number;
  };
  transactions?: {
    commit?: string;
    reveal?: string;
  };
  error?: string;
  metadata?: Record<string, any>;
  // Prepared info for real flow
  prepared?: {
    commitAddress: string;
    commitScriptHex: string;
    controlBlockHex: string;
    revealPublicKeyHex: string;
    leafVersion: number;
    requiredCommitAmount: number;
    estimatedRevealFee: number;
    network: 'mainnet' | 'signet' | 'testnet';
  };
  // Server-held secrets for reveal signing (ephemeral)
  secrets?: {
    revealPrivateKeyHex: string;
  };
}

/**
 * Update to a resource inscription record
 */
export interface ResourceInscriptionUpdate {
  status?: ResourceInscriptionStatus;
  inscriptionId?: string;
  satoshi?: string;
  resourceIndex?: number;
  completedAt?: string;
  fees?: {
    total: number;
    commit: number;
    reveal: number;
  };
  transactions?: {
    commit?: string;
    reveal?: string;
  };
  error?: string;
  prepared?: ResourceInscription['prepared'];
  secrets?: ResourceInscription['secrets'];
}

/**
 * Repository interface for resource inscriptions
 */
export interface ResourceInscriptionRepository {
  createInscription(inscription: Omit<ResourceInscription, 'id'>): Promise<ResourceInscription>;
  getInscriptionById(id: string): Promise<ResourceInscription | null>;
  getInscriptionsByParentDid(parentDid: string): Promise<ResourceInscription[]>;
  updateInscription(id: string, update: ResourceInscriptionUpdate): Promise<ResourceInscription>;
}

/**
 * Configuration for the resource inscription service
 */
export interface ResourceInscriptionServiceConfig {
  /** Default fee rate in sats/vbyte */
  defaultFeeRate: number;
  /** Maximum resource size in bytes */
  maxResourceSize: number;
  /** Maximum retry attempts for failed inscriptions */
  maxRetryAttempts: number;
  /** Retry delay in milliseconds */
  retryDelayMs: number;
  /** Whether to enable debug logging */
  enableDebugLogging: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: ResourceInscriptionServiceConfig = {
  defaultFeeRate: 10, // 10 sats/vbyte
  maxResourceSize: 10 * 1024 * 1024, // 10MB max size
  maxRetryAttempts: 3,
  retryDelayMs: 5000, // 5 seconds
  enableDebugLogging: false
};

/**
 * Service for inscribing resources linked to DIDs
 */
export class ResourceInscriptionService {
  private config: ResourceInscriptionServiceConfig;
  private didService: DIDService;

  /**
   * Create a new resource inscription service
   * 
   * @param inscriptionRepository - Repository for storing resource inscription records
   * @param apiService - API service for external operations
   * @param didService - DID service for DID operations
   * @param config - Configuration options
   */
  constructor(
    private inscriptionRepository: ResourceInscriptionRepository,
    private apiService: ApiService,
    didService?: DIDService,
    config: Partial<ResourceInscriptionServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.didService = didService || new DIDService();
    this.logDebug('ResourceInscriptionService initialized');
  }

  /**
   * Start the inscription process for a resource linked to a DID
   * 
   * @param request - The resource inscription request
   * @returns The created resource inscription record
   * @throws {ResourceInscriptionError} If the request is invalid or the DID is not found
   */
  async startInscription(request: ResourceInscriptionRequest): Promise<ResourceInscription> {
    const { 
      parentDid, 
      requesterDid, 
      satNumber,
      content, 
      contentType, 
      label, 
      resourceType,
      feeRate = this.config.defaultFeeRate, 
      metadata = {}
    } = request;
    
    this.logDebug(`Starting resource inscription`, { parentDid, requesterDid, satNumber });

    // Validate DID format only if provided
    if (parentDid && !this.isValidDid(parentDid)) {
      throw new ResourceInscriptionError(`Invalid DID format: ${parentDid}`);
    }

    // Validate content size
    if (content.length > this.config.maxResourceSize) {
      throw new ResourceInscriptionError(
        `Resource size (${content.length} bytes) exceeds maximum allowed (${this.config.maxResourceSize} bytes)`
      );
    }

    // Determine target satoshi either from direct satNumber or parentDid
    let satoshi: string | undefined = undefined;
    if (typeof satNumber === 'number' && Number.isFinite(satNumber)) {
      satoshi = String(satNumber);
    } else if (parentDid) {
      satoshi = this.getSatoshiFromDid(parentDid);
    }
    if (!satoshi) {
      throw new ResourceInscriptionError('Missing target satoshi: provide satNumber or a valid parentDid');
    }

    // Create the inscription record
    const inscription: Omit<ResourceInscription, 'id'> = {
      parentDid: parentDid || '',
      requesterDid: requesterDid || '',
      label,
      resourceType,
      contentType,
      contentSize: content.length,
      status: ResourceInscriptionStatus.PENDING,
      requestedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      satoshi,
      fees: {
        feeRate,
        total: 0,
        commit: 0,
        reveal: 0
      },
      transactions: {},
      metadata
    };

    // Store the inscription record
    const createdInscription = await this.inscriptionRepository.createInscription({
      ...inscription,
      secrets: {
        // Store content for preparation step (demo/in-memory)
        contentBase64: content.toString('base64')
      }
    } as any);

    // IMPORTANT: Do not auto-complete with mock transactions.
    // Leave status as PENDING; a real commit/reveal flow should drive updates.
    // Future: expose endpoints to prepare PSBTs and update status/txids.
    return createdInscription;
  }

  /**
   * Prepare an inscription: generate scripts, compute fees, and store reveal key.
   */
  async prepare(id: string, params: { feeRate?: number; network: 'mainnet' | 'signet' | 'testnet'; recipientAddress: string }): Promise<ResourceInscription> {
    const record = await this.inscriptionRepository.getInscriptionById(id);
    if (!record) throw new ResourceInscriptionError(`Resource inscription not found: ${id}`);
    const feeRate = params.feeRate ?? (record.fees?.feeRate || this.config.defaultFeeRate);

    // Load content from secrets
    // @ts-ignore demo repository stores secrets inline
    const contentBase64: string | undefined = record.secrets?.contentBase64;
    if (!contentBase64) throw new ResourceInscriptionError('Content not available for preparation');
    const contentBytes = Buffer.from(contentBase64, 'base64');

    // Generate ephemeral reveal keypair
    const revealPrivateKey = secp256k1.utils.randomPrivateKey();
    const revealPublicKey = schnorr.getPublicKey(revealPrivateKey);

    // Call ordinalsplus to prepare inscription scripts and fee estimates
    const prep = await opPrepareResourceInscription({
      content: new Uint8Array(contentBytes),
      contentType: record.contentType,
      resourceType: record.resourceType as any,
      publicKey: new Uint8Array(revealPublicKey),
      recipientAddress: params.recipientAddress,
      feeRate,
      network: params.network,
      metadata: record.metadata || {}
    } as any);

    const prepared = {
      commitAddress: prep.preparedInscription.commitAddress.address,
      commitScriptHex: Buffer.from(prep.preparedInscription.commitAddress.script).toString('hex'),
      controlBlockHex: Buffer.from(prep.preparedInscription.inscriptionScript.controlBlock).toString('hex'),
      revealPublicKeyHex: Buffer.from(prep.preparedInscription.revealPublicKey).toString('hex'),
      leafVersion: prep.preparedInscription.inscriptionScript.leafVersion,
      requiredCommitAmount: Number(prep.requiredCommitAmount),
      estimatedRevealFee: Number(prep.estimatedRevealFee),
      network: params.network
    } as ResourceInscription['prepared'];

    const updated = await this.updateInscriptionStatus(id, {
      status: ResourceInscriptionStatus.IN_PROGRESS,
      fees: {
        total: (record.fees?.commit || 0) + Number(prep.estimatedRevealFee),
        commit: record.fees?.commit || 0,
        reveal: Number(prep.estimatedRevealFee),
      },
      prepared,
      secrets: {
        // Persist the reveal private key for the reveal step (demo)
        revealPrivateKeyHex: Buffer.from(revealPrivateKey).toString('hex'),
        // Keep content for potential retry
        // @ts-ignore extend shape
        contentBase64
      } as any
    });

    return updated;
  }

  /**
   * Mark commit broadcasted (store txid) so we can proceed to reveal.
   */
  async acceptCommit(id: string, commitTxid: string): Promise<ResourceInscription> {
    const record = await this.inscriptionRepository.getInscriptionById(id);
    if (!record) throw new ResourceInscriptionError(`Resource inscription not found: ${id}`);
    return this.updateInscriptionStatus(id, {
      transactions: { commit: commitTxid },
      status: ResourceInscriptionStatus.IN_PROGRESS
    });
  }

  /**
   * Finalize by storing reveal txid and inscription id.
   */
  async finalizeReveal(id: string, revealTxid: string): Promise<ResourceInscription> {
    const record = await this.inscriptionRepository.getInscriptionById(id);
    if (!record) throw new ResourceInscriptionError(`Resource inscription not found: ${id}`);
    return this.updateInscriptionStatus(id, {
      transactions: { ...(record.transactions || {}), reveal: revealTxid },
      inscriptionId: revealTxid,
      status: ResourceInscriptionStatus.COMPLETED,
      completedAt: new Date().toISOString()
    });
  }

  /**
   * Process a resource inscription asynchronously
   * 
   * @param inscriptionId - The ID of the resource inscription to process
   * @param content - The content to inscribe
   */
  private async processResourceInscription(inscriptionId: string, content: Buffer): Promise<void> {
    try {
      // Get the inscription record
      const inscription = await this.inscriptionRepository.getInscriptionById(inscriptionId);
      if (!inscription) {
        throw new ResourceInscriptionError(`Resource inscription not found: ${inscriptionId}`);
      }

      // Update status to in-progress
      await this.updateInscriptionStatus(inscriptionId, {
        status: ResourceInscriptionStatus.IN_PROGRESS
      });

      // Get the satoshi number from the DID
      const satoshi = inscription.satoshi;
      if (!satoshi) {
        throw new ResourceInscriptionError(`Missing satoshi for inscription: ${inscriptionId}`);
      }

      // Get existing inscriptions on the same satoshi to determine resource index
      const existingInscriptions = await this.getInscriptionsOnSatoshi(satoshi);
      const resourceIndex = existingInscriptions.length;

      // Prepare wallet configuration (mock for now, would be replaced with actual wallet in production)
      const walletConfig: WalletConfig = await this.getWalletConfig(satoshi);
      
      // Prepare resource metadata
      const resourceMetadata: ResourceMetadata = {
        type: inscription.resourceType,
        name: inscription.label,
        description: inscription.metadata?.description || `Resource for ${inscription.parentDid}`,
        properties: inscription.metadata || {},
        size: inscription.contentSize,
        createdAt: new Date().toISOString(),
        parentDid: inscription.parentDid,
        index: resourceIndex
      };

      // Prepare fee configuration
      const feeConfig: FeeConfig = {
        feeRate: inscription.fees?.feeRate || this.config.defaultFeeRate
      };

      // Create resource parameters
      const createParams: CreateResourceParams = {
        wallet: walletConfig,
        metadata: resourceMetadata,
        content: {
          content,
          contentType: inscription.contentType
        },
        fees: feeConfig,
        satNumber: parseInt(satoshi, 10),
        parentDid: inscription.parentDid,
        resourceIndex
      };

      // Inscribe the resource
      const result = await this.inscribeResource(createParams);

      // Update the inscription record with the results
      await this.updateInscriptionStatus(inscriptionId, {
        status: ResourceInscriptionStatus.COMPLETED,
        inscriptionId: result.inscriptionId,
        resourceIndex,
        completedAt: new Date().toISOString(),
        fees: {
          total: result.fees.totalFee,
          commit: result.fees.commitFee,
          reveal: result.fees.revealFee
        },
        transactions: {
          commit: result.transactions.commit,
          reveal: result.transactions.reveal
        }
      });

      this.logDebug(`Successfully inscribed resource: ${result.inscriptionId} for DID: ${inscription.parentDid}`);
    } catch (error) {
      this.logDebug(`Error inscribing resource: ${error}`);
      
      // Update the inscription record with the error
      await this.updateInscriptionStatus(inscriptionId, {
        status: ResourceInscriptionStatus.FAILED,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }

  /**
   * Inscribe a resource using the inscription orchestrator
   * 
   * @param params - Parameters for creating the resource
   * @returns The result of the resource creation
   */
  private async inscribeResource(params: CreateResourceParams): Promise<ResourceCreationOutput> {
    // DEMO: Skip orchestrator calls for now. In a real implementation,
    // reset and prepare content on the orchestrator here.

    // Demo mode: simulate fee calc and tx ids until real integration is wired
    const fees = { commit: 500, reveal: 300, total: 800 };
    const commitTxid = `commit-${Date.now()}`;
    const revealTxid = `reveal-${Date.now()}`;
    
    // Determine resource type based on metadata
    let resourceType = params.metadata.type as string || ResourceType.DATA;
    let validationRules = DEFAULT_VALIDATION_RULES[resourceType as keyof typeof DEFAULT_VALIDATION_RULES];
    
    // Check if metadata is a verifiable credential by using type assertion
    // This allows us to access properties that might not be defined in ResourceMetadata
    const metadataAny = params.metadata as any;
    if (metadataAny['@context'] && 
        (metadataAny.type === 'VerifiableCredential' || 
         (Array.isArray(metadataAny.type) && metadataAny.type.includes('VerifiableCredential')))) {
      this.logDebug('Detected verifiable credential in metadata');
      resourceType = ResourceType.CREDENTIAL;
      validationRules = DEFAULT_VALIDATION_RULES[ResourceType.CREDENTIAL];
      
      // Check if a VC API provider ID is specified in the metadata
      let vcProviderId: string | undefined;
      if (metadataAny._vcApiProviderId) {
        vcProviderId = metadataAny._vcApiProviderId;
        this.logDebug(`Using VC API provider ID: ${vcProviderId}`);
        
        // Remove the provider ID from the metadata before saving
        // This is a non-standard property that shouldn't be included in the final credential
        delete metadataAny._vcApiProviderId;
      }
      
      // If this is a verifiable credential, we need to validate it using the VCService
      // Initialize the VCService with the specified provider ID if available
      const vcService = new VCService(this.didService, {
        // platformDid is not part of ResourceInscriptionServiceConfig; omit to satisfy types
        providerId: vcProviderId
      });
      
      // Log which provider is being used
      this.logDebug(`Using VC provider: ${vcService.getProviderInfo().name} (${vcService.getProviderInfo().url})`);
      
      // Validate the credential using the VCService
      try {
        await vcService.verifyCredential(metadataAny);
        this.logDebug('Verifiable credential validation successful');
      } catch (error) {
        this.logDebug('Verifiable credential validation failed', error);
        throw new Error(`Verifiable credential validation failed: ${(error as Error).message}`);
      }
    }

    // Return the result
    return {
      resourceId: `${params.parentDid}/resources/${params.resourceIndex}`,
      inscriptionId: revealTxid, // In a real implementation, this would be the actual inscription ID
      transactions: {
        commit: commitTxid,
        reveal: revealTxid
      },
      linkedResource: {
        // Core properties required by EnhancedLinkedResource type
        id: `resource:${revealTxid}`,
        type: params.content.contentType.startsWith('text/') ? ResourceType.DOCUMENT : ResourceType.DATA,
        inscriptionId: revealTxid,
        didReference: params.parentDid || '',
        contentType: params.content.contentType,
        size: params.content.content instanceof Buffer ? params.content.content.length : Buffer.from(params.content.content as string).length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        content_url: `${(env.CONTENT_ORD_NODE_URL || 'https://ordinals.plus')}/content/${revealTxid}`,
        sat: 0, // This would be set to the actual satoshi number in a real implementation
        
        // Additional properties
        metadata: params.metadata,
        validationRules: validationRules,
        relationships: {
          parentDid: params.parentDid || '',
          relatedResources: []
        }
      },
      fees: {
        commitFee: fees.commit,
        revealFee: fees.reveal,
        totalFee: fees.total
      }
    };
  }

  /**
   * Get wallet configuration for inscribing a resource on a specific satoshi
   * 
   * @param satoshi - The satoshi number to target
   * @returns Wallet configuration for the inscription
   */
  private async getWalletConfig(satoshi: string): Promise<WalletConfig> {
    // In a real implementation, this would:
    // 1. Find a UTXO that contains the target satoshi
    // 2. Set up the wallet with the appropriate keys
    // 3. Configure the wallet to target the specific satoshi
    
    // Mock implementation for now
    return {
      network: 'testnet',
      publicKey: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
      address: 'tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx',
      utxos: [
        {
          txid: '0000000000000000000000000000000000000000000000000000000000000000',
          vout: 0,
          value: 100000,
          scriptPubKey: ''
          // Note: In a real implementation, additional properties may be needed
          // based on the actual UTXO structure required by the inscription orchestrator
        }
      ]
    };
  }

  /**
   * Get existing inscriptions on a satoshi
   * 
   * @param satoshi - The satoshi number to query
   * @returns Array of inscriptions on the satoshi
   */
  private async getInscriptionsOnSatoshi(satoshi: string): Promise<any[]> {
    // In a real implementation, this would query the indexer for inscriptions on the satoshi
    // For now, return a mock empty array
    return [];
  }

  /**
   * Update the status of a resource inscription
   * 
   * @param id - The ID of the inscription to update
   * @param update - The update to apply
   * @returns The updated inscription
   */
  private async updateInscriptionStatus(id: string, update: ResourceInscriptionUpdate): Promise<ResourceInscription> {
    // Ensure repository is responsible for setting updatedAt to avoid type mismatch
    const updatedInscription = await this.inscriptionRepository.updateInscription(id, update);
    
    this.logDebug(`Updated inscription ${id} status to ${update.status || 'unknown'}`);
    return updatedInscription;
  }

  /**
   * Extract the satoshi number from a DID
   * 
   * @param did - The DID to extract from
   * @returns The satoshi number or undefined if not found
   */
  private getSatoshiFromDid(did: string): string | undefined {
    const match = did.match(DID_REGEX);
    return match && match[1] ? match[1] : undefined;
  }

  /**
   * Check if a DID is valid
   * 
   * @param did - The DID to validate
   * @returns True if the DID is valid
   */
  private isValidDid(did: string): boolean {
    return DID_REGEX.test(did);
  }

  /**
   * Log a debug message if debug logging is enabled
   * 
   * @param message - The message to log
   * @param data - Optional data to include
   */
  private logDebug(message: string, data?: any): void {
    if (this.config.enableDebugLogging) {
      logger.debug(`[ResourceInscriptionService] ${message}`, data);
    }
  }
}

export default ResourceInscriptionService;
