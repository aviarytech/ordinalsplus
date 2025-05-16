/**
 * Verification Service
 * 
 * This service handles verification of inscriptions and credentials by connecting
 * to verification providers and managing the verification process.
 */
import { VerificationStatus, VerificationResult, IssuerInfo } from '../types/verification';
import { ApiService } from './apiService';
import { logger } from '../utils/logger';

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
 * Service for verifying inscriptions and credentials
 */
export class VerificationService {
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
   * @returns Promise resolving to verification result
   */
  async verifyInscription(inscriptionId: string): Promise<VerificationResult> {
    this.logDebug(`Verifying inscription: ${inscriptionId}`);
    
    // Check cache first
    const cacheKey = `inscription:${inscriptionId}`;
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for inscription: ${inscriptionId}`);
      return cachedResult;
    }

    try {
      // Fetch the credential metadata from the inscription
      const response = await this.apiService.get(`/inscriptions/${inscriptionId}/metadata`);
      
      if (!response.data || !response.data.credential) {
        const noMetadataResult: VerificationResult = {
          status: VerificationStatus.NO_METADATA,
          message: 'No verifiable metadata found for this inscription',
          inscriptionId
        };
        this.cacheResult(cacheKey, noMetadataResult);
        return noMetadataResult;
      }
      
      // Verify the credential
      const credential = response.data.credential;
      const result = await this.verifyCredential(credential);
      
      // Add inscription ID to the result for reference
      const resultWithInscription = {
        ...result,
        inscriptionId
      };
      
      this.cacheResult(cacheKey, resultWithInscription);
      return resultWithInscription;
    } catch (error) {
      this.logDebug(`Error verifying inscription: ${error}`);
      
      const errorResult: VerificationResult = {
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error(String(error)),
        inscriptionId
      };
      
      this.cacheResult(cacheKey, errorResult);
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
    if (!credential || !credential.id) {
      return {
        status: VerificationStatus.ERROR,
        message: 'Invalid credential: missing ID'
      };
    }
    
    this.logDebug(`Verifying credential: ${credential.id}`);
    
    // Check cache first
    const cacheKey = `credential:${credential.id}`;
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for credential: ${credential.id}`);
      return cachedResult;
    }

    try {
      // Call the API to verify the credential
      const response = await this.apiService.post('/verifiable-credentials/verify', {
        credential
      });
      
      const isValid = response.data?.valid === true;
      
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
          message: response.data?.message || 'Credential verification failed',
          credential
        };
      }
      
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
   * Get issuer information for a DID
   * 
   * @param did - The DID to get information for
   * @returns Promise resolving to issuer information
   */
  async getIssuerInfo(did: string): Promise<IssuerInfo> {
    this.logDebug(`Getting issuer info for DID: ${did}`);
    
    // Check cache first
    const cacheKey = `issuer:${did}`;
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      this.logDebug(`Cache hit for issuer: ${did}`);
      return cachedResult;
    }

    try {
      // Call the API to get issuer info
      const response = await this.apiService.get(`/did/${did}`);
      
      const issuerInfo: IssuerInfo = {
        did,
        name: response.data?.name,
        url: response.data?.url,
        avatar: response.data?.avatar
      };
      
      this.cacheResult(cacheKey, issuerInfo);
      return issuerInfo;
    } catch (error) {
      this.logDebug(`Error getting issuer info: ${error}`);
      
      // Return basic info if we can't get detailed info
      return { did };
    }
  }

  /**
   * Clear the verification cache
   */
  clearCache(): void {
    this.cache.clear();
    this.logDebug('Verification cache cleared');
  }

  /**
   * Get a cached result if it exists and is not expired
   * 
   * @param key - Cache key
   * @returns Cached result or undefined
   */
  private getCachedResult<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (entry && Date.now() - entry.timestamp < this.config.cacheTtlMs!) {
      return entry.result as T;
    }
    
    return undefined;
  }

  /**
   * Cache a result
   * 
   * @param key - Cache key
   * @param result - Result to cache
   */
  private cacheResult<T>(key: string, result: T): void {
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
      logger.debug(`[VerificationService] ${message}`);
    }
  }
}

export default VerificationService;
