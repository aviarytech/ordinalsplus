/**
 * Verification Service
 * 
 * This service handles verification of inscriptions and credentials by calling
 * the backend API which performs DID resolution server-side.
 */
import ApiService from './apiService';
import { 
  VerificationStatus, 
  VerificationResult, 
  IssuerInfo,
  IVerificationService,
  VerifiableCredential 
} from '../types/verification';
import { VCService } from 'ordinalsplus'
import { StaticDataProvider, StaticSatData } from '../../../ordinalsplus/src/resources/providers/static-data-provider'

/**
 * Cache entry for verification results
 */
interface CacheEntry {
  result: VerificationResult;
  timestamp: number;
}

/**
 * Configuration for the verification service
 */
export interface VerificationServiceConfig {
  /** Cache TTL in milliseconds (default: 5 minutes) */
  cacheTtlMs?: number;
  /** Whether to enable debug logging */
  enableDebugLogging?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: VerificationServiceConfig = {
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  enableDebugLogging: false
};

/**
 * Frontend service for verifying inscriptions and credentials
 * This service calls the backend API for verification and DID resolution
 */
export class VerificationService implements IVerificationService {
  private cache: Map<string, CacheEntry> = new Map();
  private config: VerificationServiceConfig;

  /**
   * Create a new verification service
   * 
   * @param apiService - The API service to use for verification
   * @param config - Configuration options
   */
  constructor(
    private apiService: ApiService,
    config: Partial<VerificationServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logDebug('VerificationService initialized');
  }

  /**
   * Verify an inscription by its ID
   * 
   * @param inscriptionId - The ID of the inscription to verify
   * @param existingInscriptionData - The existing inscription data to verify (required to avoid refetching)
   * @param network - Optional network override
   * @returns Promise resolving to verification result
   */
  async verifyInscription(
    inscriptionId: string,
    existingInscriptionData: {
      contentBase64?: string;
      contentType?: string;
      metadata?: any;
    },
    network?: 'mainnet' | 'testnet' | 'signet'
  ): Promise<VerificationResult> {
    this.logDebug(`Verifying inscription: ${inscriptionId}`);
    this.logDebug(`Inscription data received: ${JSON.stringify({
      hasContentBase64: !!existingInscriptionData?.contentBase64,
      hasContentType: !!existingInscriptionData?.contentType,
      hasMetadata: !!existingInscriptionData?.metadata,
      contentLength: existingInscriptionData?.contentBase64?.length || 0
    })}`);
    
    // Check cache first
    const cacheKey = `inscription:${inscriptionId}`;
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for inscription: ${inscriptionId}`);
      return cachedResult;
    }

    try {
      // Validate that inscription data was provided
      if (!existingInscriptionData) {
        const errorResult: VerificationResult = {
          status: VerificationStatus.ERROR,
          message: 'No inscription data provided - data is required to avoid API calls'
        };
        this.cacheResult(cacheKey, errorResult);
        return errorResult;
      }

      // Use provided network or default
      const targetNetwork = network || 'signet';
      this.logDebug(`Using network: ${targetNetwork} for inscription ${inscriptionId}`);

      let metadata: any;

      // Always use existing data since it's now required
      this.logDebug(`Using provided inscription data for ${inscriptionId}`);
      
      if (existingInscriptionData.metadata) {
        // If metadata is directly provided, use it
        metadata = existingInscriptionData.metadata;
        this.logDebug(`Using directly provided metadata for ${inscriptionId}`);
      } else if (existingInscriptionData.contentBase64) {
        // If we have content, try to extract metadata from it
        try {
          const contentBuffer = Buffer.from(existingInscriptionData.contentBase64, 'base64');
          const contentString = contentBuffer.toString('utf8');
          metadata = JSON.parse(contentString);
          this.logDebug(`Extracted metadata from content for ${inscriptionId}`);
        } catch (parseError) {
          this.logDebug(`Existing content is not JSON: ${parseError}`);
          const noMetadataResult: VerificationResult = {
            status: VerificationStatus.NO_METADATA,
            message: 'Inscription content is not valid JSON metadata'
          };
          this.cacheResult(cacheKey, noMetadataResult);
          return noMetadataResult;
        }
      } else {
        const noMetadataResult: VerificationResult = {
          status: VerificationStatus.NO_METADATA,
          message: 'No content or metadata provided in inscription data'
        };
        this.cacheResult(cacheKey, noMetadataResult);
        return noMetadataResult;
      }
        
      // If we still don't have metadata, the inscription doesn't contain a VC
      if (!metadata) {
        const noMetadataResult: VerificationResult = {
          status: VerificationStatus.NO_METADATA,
          message: 'Inscription does not contain verifiable credential metadata'
        };
        this.cacheResult(cacheKey, noMetadataResult);
        return noMetadataResult;
      }

      // Check if metadata is a verifiable credential
      if (!this.isVerifiableCredential(metadata)) {
        const notVcResult: VerificationResult = {
          status: VerificationStatus.NO_METADATA,
          message: 'Inscription metadata is not a verifiable credential'
        };
        this.cacheResult(cacheKey, notVcResult);
        return notVcResult;
      }

      // Verify the credential
      const result = await this.verifyCredential(metadata);
      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      this.logDebug(`Error verifying inscription: ${error}`);
      
      const errorResult: VerificationResult = {
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
      
      this.cacheResult(cacheKey, errorResult);
      return errorResult;
    }
  }

  /**
   * Verify a credential directly using BtcoDidResolver for DID verification
   * 
   * @param credential - The credential to verify
   * @returns Promise resolving to verification result
   */
  async verifyCredential(credential: VerifiableCredential): Promise<VerificationResult> {
    if (!credential || (!credential.id && !credential.issuer)) {
      return {
        status: VerificationStatus.ERROR,
        message: 'Invalid credential: missing required fields'
      };
    }
    
    this.logDebug(`Verifying credential: ${credential.id || 'no-id'}`);
    
    // Check cache first
    const cacheKey = `credential:${credential.id || JSON.stringify(credential).substring(0, 100)}`;
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for credential`);
      return cachedResult;
    }

    try {
      // Use basic verification with DID resolution
      const result = await this.basicVerifyCredential(credential);
      this.cacheResult(cacheKey, result);
      return result;
    } catch (error) {
      this.logDebug(`Error verifying credential: ${error}`);
      
      const errorResult: VerificationResult = {
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        credential,
        error: error instanceof Error ? error : new Error(String(error))
      };
      
      this.cacheResult(cacheKey, errorResult);
      return errorResult;
    }
  }

  /**
   * Basic verification using backend API
   * 
   * @param credential - The credential to verify
   * @returns Promise resolving to verification result
   */
  private async basicVerifyCredential(credential: VerifiableCredential): Promise<VerificationResult> {
    try {
      // Basic structure validation
      if (!this.isVerifiableCredential(credential)) {
        return {
          status: VerificationStatus.INVALID,
          message: 'Invalid credential structure',
          credential
        };
      }
      
      // Extract the sat number from the credential subject to validate against
      let satNumber: string | undefined;
      const subjectId = Array.isArray(credential.credentialSubject) 
        ? credential.credentialSubject[0]?.id 
        : credential.credentialSubject.id;
      
      if (subjectId && subjectId.startsWith('did:btco')) {
        const extractedSatNumber = this.extractSatNumberFromDid(subjectId);
        if (!extractedSatNumber) {
          return {
            status: VerificationStatus.ERROR,
            message: 'Failed to extract sat number from credential subject DID',
            credential
          };
        }
        satNumber = extractedSatNumber;
        this.logDebug(`Extracted sat number ${satNumber} from credential subject: ${subjectId}`);
      }
      
      // Create a static data provider with known DIDs that need to be resolved
      const staticDataProvider = await this.createStaticDataProvider([typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id]);
      const service = new VCService({ resourceProvider: staticDataProvider });

      const result = await service.verifyCredential(credential as any, satNumber) ? {
        status: VerificationStatus.VALID,
        message: 'Credential structure valid and issuer DID resolved successfully',
        credential,
        issuer: typeof credential.issuer === 'string' 
          ? { did: credential.issuer } as IssuerInfo
          : { did: credential.issuer.id, ...credential.issuer } as IssuerInfo,
        verifiedAt: new Date()
      } : {
        status: VerificationStatus.ERROR,
        message: 'Credential verification failed',
        credential
      };
      
      if (result.status === 'error') {
        return {
          status: VerificationStatus.ERROR,
          message: result.message || 'Backend verification failed',
          credential
        };
      }
      
      if (result.status === 'valid') {
        return {
          status: VerificationStatus.VALID,
          message: 'Credential structure valid and issuer DID resolved successfully',
          credential,
          issuer: result.issuer,
          verifiedAt: result.verifiedAt ? new Date(result.verifiedAt) : new Date()
        };
      } else {
        return {
          status: VerificationStatus.INVALID,
          message: result.message || 'Credential verification failed',
          credential
        };
      }
    } catch (error) {
      return {
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        credential,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get issuer information for a DID using the backend API
   * 
   * @param did - The DID to get information for
   * @returns Promise resolving to issuer information
   */
  async getIssuerInfo(did: string): Promise<IssuerInfo> {
    this.logDebug(`Getting issuer info for: ${did}`);
    
    // Check cache first
    const cacheKey = `issuer:${did}`;
    const cachedResult = this.getCachedResult(cacheKey) as VerificationResult;
    if (cachedResult && cachedResult.issuer) {
      this.logDebug(`Cache hit for issuer: ${did}`);
      return cachedResult.issuer;
    }

    try {
      // Get issuer info from backend API
      const result = await this.apiService.getIssuerInfo(did);
      
      if (result.status === 'error') {
        throw new Error(result.message || 'Failed to get issuer info');
      }
      
      const issuerInfo: IssuerInfo = {
        did,
        name: result.issuer.name,
        url: result.issuer.url,
        avatar: result.issuer.avatar,
        didDocument: result.issuer.didDocument
      };
      
      // Cache the issuer info
      this.cacheResult(cacheKey, { issuer: issuerInfo } as VerificationResult);
      
      return issuerInfo;
    } catch (error) {
      this.logDebug(`Error getting issuer info: ${error}`);
      
      // Return basic info with just the DID if resolution fails
      return { did };
    }
  }

  /**
   * Verify metadata directly as a Verifiable Credential
   * 
   * @param metadata - The metadata object that contains VC properties at top level
   * @returns Promise resolving to verification result
   */
  async verifyMetadataAsCredential(metadata: any): Promise<VerificationResult> {
    if (!metadata || typeof metadata !== 'object') {
      return {
        status: VerificationStatus.ERROR,
        message: 'Invalid metadata: not an object'
      };
    }

    // Check if metadata has VC structure at top level
    if (!this.isVerifiableCredential(metadata)) {
      return {
        status: VerificationStatus.NO_METADATA,
        message: 'Metadata does not contain a valid Verifiable Credential structure'
      };
    }

    // Treat the metadata as the credential directly
    return this.verifyCredential(metadata as VerifiableCredential);
  }

  /**
   * Check if an object is a valid verifiable credential according to W3C spec
   * 
   * @param obj - Object to check
   * @returns True if it's a valid VC structure
   */
  private isVerifiableCredential(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    
    // Check for required VC fields according to W3C VC spec
    // Note: 'id' is optional in W3C VC spec, so we don't require it
    return (
      obj['@context'] &&
      obj.type &&
      (Array.isArray(obj.type) ? obj.type.includes('VerifiableCredential') : obj.type === 'VerifiableCredential') &&
      obj.issuer &&
      obj.credentialSubject
    );
  }

  /**
   * Clear the verification cache
   */
  clearCache(): void {
    this.logDebug('Clearing verification cache');
    this.cache.clear();
  }

  /**
   * Get a cached result if it's still valid
   * 
   * @param key - Cache key
   * @returns Cached result or undefined if not found or expired
   */
  private getCachedResult(key: string): VerificationResult | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > this.config.cacheTtlMs!) {
      // Entry has expired
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.result;
  }

  /**
   * Cache a verification result
   * 
   * @param key - Cache key
   * @param result - Result to cache
   */
  private cacheResult(key: string, result: VerificationResult): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Log a debug message if debug logging is enabled
   * 
   * @param message - Message to log
   */
  private logDebug(message: string): void {
    if (this.config.enableDebugLogging) {
      console.debug(`[VerificationService] ${message}`);
    }
  }

  /**
   * Verify inscription data directly (when you already have the inscription loaded)
   * 
   * @param inscriptionData - The inscription data to verify
   * @param inscriptionId - Optional inscription ID for caching
   * @returns Promise resolving to verification result
   */
  async verifyInscriptionData(
    inscriptionData: {
      contentBase64?: string;
      contentType?: string;
      metadata?: any;
      id?: string;
    },
    inscriptionId?: string
  ): Promise<VerificationResult> {
    const id = inscriptionId || inscriptionData.id || 'unknown';
    this.logDebug(`Verifying inscription data for: ${id}`);
    
    let metadata: any;

    // Extract metadata from the provided data
    if (inscriptionData.metadata) {
      // If metadata is directly provided, use it
      metadata = inscriptionData.metadata;
      this.logDebug(`Using directly provided metadata for ${id}`);
    } else if (inscriptionData.contentBase64) {
      // If we have content, try to extract metadata from it
      try {
        const contentBuffer = Buffer.from(inscriptionData.contentBase64, 'base64');
        const contentString = contentBuffer.toString('utf8');
        metadata = JSON.parse(contentString);
        this.logDebug(`Extracted metadata from content for ${id}`);
      } catch (parseError) {
        this.logDebug(`Content is not JSON for ${id}: ${parseError}`);
        return {
          status: VerificationStatus.NO_METADATA,
          message: 'Inscription content is not valid JSON metadata'
        };
      }
    } else {
      return {
        status: VerificationStatus.NO_METADATA,
        message: 'No content or metadata provided in inscription data'
      };
    }

    // Check if metadata is a verifiable credential
    if (!this.isVerifiableCredential(metadata)) {
      return {
        status: VerificationStatus.NO_METADATA,
        message: 'Inscription metadata is not a verifiable credential'
      };
    }

    // Verify the credential
    return this.verifyCredential(metadata);
  }

  /**
   * Create a static data provider with known DIDs that need to be resolved
   * This pre-loads DID data for common DIDs to avoid API calls during verification
   */
  private async createStaticDataProvider(dids: string[]): Promise<StaticDataProvider> {
    // Start with an empty provider
    const provider = new StaticDataProvider([]);
    
    // Loop through each DID and resolve it
    for (const did of dids) {
      try {
        this.logDebug(`Resolving DID: ${did}`);
        
        // Parse the DID to extract sat number (e.g., "did:btco:123456789" -> "123456789")
        const satNumber = this.extractSatNumberFromDid(did);
        if (!satNumber) {
          this.logDebug(`Invalid DID format: ${did}`);
          continue;
        }
        
        // Use the proper DID resolution API that actually resolves the DID
        const result = await this.apiService.resolveDid(did);
        
        if (result.didDocument && result.inscriptions && result.inscriptions.length > 0) {
          // Convert the API response inscriptions to StaticSatData format
          const staticSat: StaticSatData = {
            satNumber,
            inscriptions: result.inscriptions.map(inscription => ({
              inscriptionId: inscription.inscriptionId,
              content: inscription.content,
              metadata: inscription.metadata,
              contentUrl: inscription.contentUrl
            }))
          };
          
          provider.addSatData(staticSat);
          this.logDebug(`Successfully loaded DID data for ${did} with ${result.inscriptions.length} inscriptions`);
        } else {
          this.logDebug(`No DID document or inscriptions found for ${did}`);
        }
        
      } catch (error) {
        this.logDebug(`Failed to resolve DID ${did}: ${error}`);
        // Continue with other DIDs even if one fails
        continue;
      }
    }
    
    return provider;
  }

  /**
   * Extract sat number from a BTCO DID
   * @param did - The DID (e.g., "did:btco:123456789")
   * @returns The sat number as string or null if invalid
   */
  private extractSatNumberFromDid(did: string): string | null {
    // BTCO DID format: did:btco[:[network]]:<sat-number>[/<path>]
    const regex = /^did:btco(?::(test|sig))?:([0-9]+)(?:\/(.+))?$/;
    const match = did.match(regex);
    
    if (!match) {
      return null;
    }
    
    return match[2]; // The sat number
  }
}
