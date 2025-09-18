/**
 * Verification Service
 * 
 * This service handles verification of inscriptions and credentials by connecting
 * to verification providers and managing the verification process.
 */
import { VerificationStatus, type VerificationResult, type IssuerInfo } from '../types/verification';
import { ApiService } from './apiService';
import { DIDService } from './didService';
import { VCService } from './vcService';
import { logger } from '../utils/logger';
import { BtcoDidResolver } from 'ordinalsplus';
import { env } from '../config/envConfig';

/**
 * Cache entry for verification results
 */
interface VerificationCacheEntry {
  result: VerificationResult;
  timestamp: number;
}

/**
 * Cache entry for issuer info
 */
interface IssuerCacheEntry {
  result: IssuerInfo;
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
  /** ACES API configuration for VC verification */
  acesApiUrl?: string;
  acesApiKey?: string;
  /** Platform DID for verification operations */
  platformDid?: string;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: VerificationServiceConfig = {
  cacheTtlMs: 5 * 60 * 1000, // 5 minutes
  enableDebugLogging: false
};

/**
 * Service for verifying inscriptions and credentials
 */
export class VerificationService {
  private verificationCache: Map<string, VerificationCacheEntry> = new Map();
  private issuerCache: Map<string, IssuerCacheEntry> = new Map();
  private config: VerificationServiceConfig;
  private didResolver: BtcoDidResolver;
  private didService: DIDService;
  private vcService: VCService;

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
    
    // Initialize DID resolver with server-side capabilities
    this.didResolver = new BtcoDidResolver();

    // Initialize DIDService and VCService for cryptographic VC verification
    this.didService = new DIDService();
    this.vcService = new VCService(this.didService, {
      // Use default provider config; can be overridden via env or future config
      enableLogging: this.config.enableDebugLogging === true
    });
  }

  /**
   * Verify an inscription by its ID
   * 
   * @param inscriptionId - The ID of the inscription to verify
   * @returns Promise resolving to verification result
   */
  async verifyInscription(inscriptionId: string): Promise<VerificationResult> {
    this.logDebug(`Verifying inscription: ${inscriptionId}`);
    
    // Check cache first
    const cacheKey = `inscription:${inscriptionId}`;
    const cachedResult = this.getCachedVerificationResult(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for inscription: ${inscriptionId}`);
      return cachedResult;
    }

    try {
      // Try to get metadata from inscription using Ordiscan API
      let metadata: any = null;
      
      try {
        metadata = await this.fetchInscriptionMetadata(inscriptionId);
      } catch (fetchError) {
        this.logDebug(`Failed to get metadata: ${fetchError}`);
        // Fallback to existing API call if available
        try {
          const response = await this.apiService.get(`/inscriptions/${inscriptionId}/metadata`);
          metadata = response.data;
        } catch (apiError) {
          this.logDebug(`Failed to get metadata from API: ${apiError}`);
        }
      }
      
      if (!metadata) {
        const noMetadataResult: VerificationResult = {
          status: VerificationStatus.NO_METADATA,
          message: 'No verifiable metadata found for this inscription',
          inscriptionId
        };
        this.cacheVerificationResult(cacheKey, noMetadataResult);
        return noMetadataResult;
      }
      
      // Check if metadata is a verifiable credential
      if (!this.isVerifiableCredential(metadata)) {
        const notVcResult: VerificationResult = {
          status: VerificationStatus.NO_METADATA,
          message: 'Inscription metadata is not a verifiable credential',
          inscriptionId
        };
        this.cacheVerificationResult(cacheKey, notVcResult);
        return notVcResult;
      }
      
      // Verify the credential
      const result = await this.verifyCredential(metadata);
      
      // Add inscription ID to the result for reference
      const resultWithInscription = {
        ...result,
        inscriptionId
      };
      
      this.cacheVerificationResult(cacheKey, resultWithInscription);
      return resultWithInscription;
    } catch (error) {
      this.logDebug(`Error verifying inscription: ${error}`);
      
      const errorResult: VerificationResult = {
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error(String(error)),
        inscriptionId
      };
      
      this.cacheVerificationResult(cacheKey, errorResult);
      return errorResult;
    }
  }

  /**
   * Verify a credential directly
   * 
   * @param credential - The credential to verify
   * @returns Promise resolving to verification result
   */
  async verifyCredential(credential: any): Promise<VerificationResult> {
    this.logDebug(`Verifying credential: ${credential.id || 'no-id'}`);
    
    // Check cache first (use id or generate cache key from content)
    const cacheKey = `credential:${credential.id || JSON.stringify(credential).substring(0, 100)}`;
    const cachedResult = this.getCachedVerificationResult(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for credential`);
      return cachedResult;
    }

    try {
      // First, perform DID/document structure sanity check
      const basicValid = await this.basicVerifyCredential(credential);
      if (!basicValid) {
        const invalidResult: VerificationResult = {
          status: VerificationStatus.INVALID,
          message: 'Credential structure or issuer DID resolution failed',
          credential
        };
        this.cacheVerificationResult(cacheKey, invalidResult);
        return invalidResult;
      }

      // Perform cryptographic signature verification using VCService
      const isValid = await this.vcService.verifyCredential(credential);
      
      let result: VerificationResult;
      
      if (isValid) {
        // Get issuer info if verification succeeded
        const issuerDid = typeof credential.issuer === 'string' 
          ? credential.issuer 
          : credential.issuer.id;
          
        const issuerInfo = await this.getIssuerInfo(issuerDid);
        
        result = {
          status: VerificationStatus.VALID,
          message: 'Credential successfully verified',
          credential,
          issuer: issuerInfo,
          verifiedAt: new Date()
        };
      } else {
        result = {
          status: VerificationStatus.INVALID,
          message: 'Credential signature verification failed',
          credential
        };
      }
      
      this.cacheVerificationResult(cacheKey, result);
      return result;
    } catch (error) {
      this.logDebug(`Error verifying credential: ${error}`);
      
      const errorResult: VerificationResult = {
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        credential,
        error: error instanceof Error ? error : new Error(String(error))
      };
      
      this.cacheVerificationResult(cacheKey, errorResult);
      return errorResult;
    }
  }

  /**
   * Basic verification of a credential structure and DID resolution
   * 
   * @param credential - The credential to verify
   * @returns Promise resolving to verification result
   */
  private async basicVerifyCredential(credential: any): Promise<boolean> {
    try {
      // Basic structure validation
      if (!this.isVerifiableCredential(credential)) {
        return false;
      }
      
      // Verify issuer DID exists and is valid
      const issuerDid = typeof credential.issuer === 'string' 
        ? credential.issuer 
        : credential.issuer.id;
      
      if (!issuerDid) {
        return false;
      }
      
      console.log('issuerDid', issuerDid);
      // Resolve the DID to verify it exists and is valid
      try {
        const didResolution = await this.didResolver.resolve(issuerDid);
        
        if (didResolution.resolutionMetadata.error) {
          this.logDebug(`DID resolution failed: ${didResolution.resolutionMetadata.error}`);
          return false;
        }
        
        if (!didResolution.didDocument) {
          this.logDebug('No DID document found');
          return false;
        }
        
        // Verify the DID document ID matches the issuer DID
        if (didResolution.didDocument.id !== issuerDid) {
          this.logDebug(`DID document ID mismatch: expected ${issuerDid}, got ${didResolution.didDocument.id}`);
          return false;
        }
        
        return true;
      } catch (error) {
        this.logDebug(`DID resolution error: ${error}`);
        return false;
      }
    } catch (error) {
      this.logDebug(`Basic verification error: ${error}`);
      return false;
    }
  }

  /**
   * Fetch inscription metadata using the Ordiscan API
   * 
   * @param inscriptionId - The inscription ID
   * @returns Promise resolving to metadata
   */
  private async fetchInscriptionMetadata(inscriptionId: string): Promise<any> {
    const apiKey = env.ORDISCAN_API_KEY;
    if (!apiKey) {
      throw new Error('Ordiscan API key not configured');
    }
    
    try {
      const response = await fetch(`https://api.ordiscan.com/v1/inscription/${inscriptionId}/metadata`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.text();
      
      // Try to decode CBOR if it's hex-encoded
      if (data && data.length > 0) {
        try {
          // Simple hex decode and assume JSON content for now
          const hexMatch = data.match(/^[0-9a-fA-F]+$/);
          if (hexMatch) {
            // Convert hex to bytes and try to decode as JSON
            const bytes = new Uint8Array(data.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
            const decoded = new TextDecoder().decode(bytes);
            return JSON.parse(decoded);
          } else {
            // Try to parse as JSON directly
            return JSON.parse(data);
          }
        } catch (parseError) {
          // If parsing fails, return the raw data
          return { rawData: data };
        }
      }
      
      return null;
    } catch (error) {
      throw new Error(`Failed to fetch inscription metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an object is a valid verifiable credential
   * 
   * @param obj - Object to check
   * @returns True if it's a valid VC structure
   */
  private isVerifiableCredential(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    
    // Check for required VC fields according to W3C VC spec
    return (
      obj['@context'] &&
      obj.type &&
      (Array.isArray(obj.type) ? obj.type.includes('VerifiableCredential') : obj.type === 'VerifiableCredential') &&
      obj.issuer &&
      obj.credentialSubject
    );
  }

  /**
   * Get issuer information for a DID using BTCO DID resolution
   * 
   * @param did - The DID to get information for
   * @returns Promise resolving to issuer information
   */
  async getIssuerInfo(did: string): Promise<IssuerInfo> {
    this.logDebug(`Getting issuer info for: ${did}`);
    
    // Check cache first
    const cacheKey = did;
    const cachedResult = this.getCachedIssuerInfo(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for issuer: ${did}`);
      return cachedResult;
    }

    try {
      // Resolve the DID using BTCO DID resolver
      const didResolution = await this.didResolver.resolve(did);
      
      if (didResolution.resolutionMetadata.error) {
        throw new Error(`DID resolution failed: ${didResolution.resolutionMetadata.error}`);
      }
      
      const didDocument = didResolution.didDocument;
      
      if (!didDocument) {
        throw new Error('No DID document found');
      }
      
      // Extract service endpoint URL, handling array case
      let serviceUrl: string | undefined;
      if (didDocument.service && Array.isArray(didDocument.service) && didDocument.service.length > 0) {
        const firstService = didDocument.service[0];
        if (firstService) {
          serviceUrl = typeof firstService.serviceEndpoint === 'string' 
            ? firstService.serviceEndpoint 
            : undefined;
        }
      }
      
      const issuerInfo: IssuerInfo = {
        did,
        name: didDocument.id || did,
        url: serviceUrl,
        avatar: (didDocument as any).image || undefined,
        didDocument: didDocument // Include the full DID document for frontend use
      };
      
      // Cache the issuer info
      this.cacheIssuerInfo(cacheKey, issuerInfo);
      
      return issuerInfo;
    } catch (error) {
      this.logDebug(`Error getting issuer info: ${error}`);
      
      // Return basic info with just the DID if resolution fails
      const basicIssuerInfo: IssuerInfo = { did };
      this.cacheIssuerInfo(cacheKey, basicIssuerInfo);
      return basicIssuerInfo;
    }
  }

  /**
   * Clear the verification cache
   */
  clearCache(): void {
    this.verificationCache.clear();
    this.issuerCache.clear();
    this.logDebug('Verification cache cleared');
  }

  /**
   * Get a cached verification result if it exists and is not expired
   * 
   * @param key - Cache key
   * @returns Cached result or undefined
   */
  private getCachedVerificationResult(key: string): VerificationResult | undefined {
    const entry = this.verificationCache.get(key);
    
    if (entry && Date.now() - entry.timestamp < this.config.cacheTtlMs!) {
      return entry.result;
    }
    
    return undefined;
  }

  /**
   * Get a cached issuer info if it exists and is not expired
   * 
   * @param key - Cache key
   * @returns Cached result or undefined
   */
  private getCachedIssuerInfo(key: string): IssuerInfo | undefined {
    const entry = this.issuerCache.get(key);
    
    if (entry && Date.now() - entry.timestamp < this.config.cacheTtlMs!) {
      return entry.result;
    }
    
    return undefined;
  }

  /**
   * Cache a verification result
   * 
   * @param key - Cache key
   * @param result - Result to cache
   */
  private cacheVerificationResult(key: string, result: VerificationResult): void {
    this.verificationCache.set(key, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Cache issuer info
   * 
   * @param key - Cache key
   * @param result - Result to cache
   */
  private cacheIssuerInfo(key: string, result: IssuerInfo): void {
    this.issuerCache.set(key, {
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
      logger.debug(`[VerificationService] ${message}`);
    }
  }
}

export default VerificationService;
