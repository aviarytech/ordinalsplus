/**
 * Verifiable Credential Service
 * 
 * This module provides a high-level service for managing verifiable credentials
 * using the Aces VC API client and integrating with the DID service.
 */

import { DidResolver } from '../did';
import { 
  AcesApiClient, 
  IssueCredentialParams,
  VerifyCredentialParams,
  RevokeCredentialParams,
  CheckStatusParams
} from './api-client';
import { 
  VerifiableCredential, 
  CredentialIssuanceParams,
  ContentInfo,
  ProofType
} from './types';
import { 
  prepareCredentialSubject,
  prepareCredential,
  VC_CONTEXTS,
  calculateContentHash
} from './formatters';
import { validateCredential } from './validators';

/**
 * Configuration for the VC service
 */
export interface VCServiceConfig {
  /** Base URL for the Aces API */
  acesApiUrl: string;
  
  /** API key for Aces API authentication */
  acesApiKey: string;
  
  /** Platform-wide DID used for certain operations */
  platformDid: string;
  
  /** Default proof type to use when issuing credentials */
  defaultProofType?: ProofType;
  
  /** Request timeout in milliseconds */
  timeout?: number;
  
  /** Whether to enable request retries */
  enableRetry?: boolean;
  
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * High-level service for managing verifiable credentials
 */
export class VCService {
  private apiClient: AcesApiClient;
  private didResolver: DidResolver;
  private config: VCServiceConfig;
  
  /**
   * Creates a new VCService instance
   * 
   * @param didResolver - DID resolver for verifying credentials
   * @param config - Service configuration
   */
  constructor(didResolver: DidResolver, config: VCServiceConfig) {
    this.didResolver = didResolver;
    this.config = {
      defaultProofType: ProofType.DATA_INTEGRITY,
      ...config
    };
    
    this.apiClient = new AcesApiClient({
      apiUrl: this.config.acesApiUrl,
      apiKey: this.config.acesApiKey,
      timeout: this.config.timeout,
      enableRetry: this.config.enableRetry,
      maxRetries: this.config.maxRetries,
      retryDelay: this.config.retryDelay
    });
  }
  
  /**
   * Creates standard credential context array for W3C VC Data Model 2.0
   * 
   * @returns Array of context URIs
   */
  private prepareCredentialContext(): string[] {
    return [
      VC_CONTEXTS.CORE_V2,
      VC_CONTEXTS.ORDINALS_PLUS
    ];
  }
  
  /**
   * Issues a verifiable credential for an inscription
   * 
   * @param params - Parameters for credential issuance
   * @returns The issued credential
   */
  async issueCredential(params: CredentialIssuanceParams): Promise<VerifiableCredential> {
    const { subjectDid, issuerDid, metadata, contentInfo } = params;
    
    // Validate issuer DID
    const didResolution = await this.didResolver.resolve(issuerDid);
    if (didResolution.didResolutionMetadata.error) {
      throw new Error(`Invalid issuer DID: ${didResolution.didResolutionMetadata.error}`);
    }
    
    // Prepare credential data according to W3C VC Data Model 2.0
    const credentialData: Omit<VerifiableCredential, 'proof'> = {
      '@context': this.prepareCredentialContext(),
      'type': ['VerifiableCredential', 'VerifiableCollectible'],
      'issuer': { 'id': issuerDid },
      'credentialSubject': prepareCredentialSubject(subjectDid, metadata, contentInfo),
      'issuanceDate': new Date().toISOString()
    };
    
    // Optional fields
    if (metadata.expirationDate) {
      credentialData.expirationDate = metadata.expirationDate;
    }
    
    // Generate a credential ID if not present in the metadata
    if (metadata.id) {
      credentialData.id = metadata.id;
    }
    
    // Validate credential data before submitting to API
    const validationResult = validateCredential(credentialData);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors ? validationResult.errors.join(', ') : 'Unknown validation error';
      throw new Error(`Invalid credential data: ${errorMessages}`);
    }
    
    // Call API to issue credential
    const issueParams: IssueCredentialParams = {
      credential: credentialData,
      issuerDid,
      proofType: this.config.defaultProofType
    };
    
    // Issue the credential through the API
    try {
      const signedCredential = await this.apiClient.issueCredential(issueParams);
      
      // Verify the returned credential
      const isValid = await this.verifyCredential(signedCredential);
      if (!isValid) {
        throw new Error('Issued credential verification failed');
      }
      
      return signedCredential;
    } catch (error: unknown) {
      console.error('Failed to issue credential:', error);
      throw new Error(`Credential issuance failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Verifies a credential's authenticity
   * 
   * @param credential - The credential to verify
   * @returns Whether the credential is valid
   */
  async verifyCredential(credential: VerifiableCredential): Promise<boolean> {
    // First perform local validation of the credential structure
    const validationResult = validateCredential(credential);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors ? validationResult.errors.join(', ') : 'Unknown validation error';
      console.error('Credential validation failed:', errorMessages);
      return false;
    }
    
    // Resolve the issuer DID to get verification method
    const issuerDid = credential.issuer.id;
    const didResolution = await this.didResolver.resolve(issuerDid);
    
    if (didResolution.didResolutionMetadata.error) {
      console.error('Failed to resolve issuer DID:', didResolution.didResolutionMetadata.error);
      return false;
    }
    
    // If the credential doesn't have a proof, it can't be verified
    if (!credential.proof) {
      console.error('Credential has no proof');
      return false;
    }
    
    // Verify using the API
    const verifyParams: VerifyCredentialParams = {
      credential
    };
    
    try {
      return await this.apiClient.verifyCredential(verifyParams);
    } catch (error: unknown) {
      console.error('API verification failed:', error);
      return false;
    }
  }
  
  /**
   * Revokes a previously issued credential
   * 
   * @param credentialId - ID of the credential to revoke
   * @param issuerDid - DID of the issuer
   * @param reason - Optional reason for revocation
   * @returns Whether the revocation was successful
   */
  async revokeCredential(credentialId: string, issuerDid: string, reason?: string): Promise<boolean> {
    const params: RevokeCredentialParams = {
      credentialId,
      issuerDid,
      reason
    };
    
    try {
      return await this.apiClient.revokeCredential(params);
    } catch (error: unknown) {
      console.error('Failed to revoke credential:', error);
      throw new Error(`Credential revocation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Checks the status of a credential
   * 
   * @param credentialId - ID of the credential to check
   * @returns Status information about the credential
   */
  async checkCredentialStatus(credentialId: string): Promise<{
    active: boolean;
    revokedAt?: string;
    revocationReason?: string;
  }> {
    const params: CheckStatusParams = {
      credentialId
    };
    
    try {
      return await this.apiClient.checkCredentialStatus(params);
    } catch (error: unknown) {
      console.error('Failed to check credential status:', error);
      throw new Error(`Checking credential status failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Creates a content info object from raw content
   * 
   * @param content - Raw content buffer
   * @param mimeType - MIME type of the content
   * @param dimensions - Optional dimensions for image/video content
   * @returns Content info object
   */
  async createContentInfo(
    content: Buffer,
    mimeType: string,
    dimensions?: { width: number; height: number }
  ): Promise<ContentInfo> {
    const contentInfo: ContentInfo = {
      mimeType,
      hash: calculateContentHash(content),
      size: content.length
    };
    
    if (dimensions) {
      contentInfo.dimensions = dimensions;
    }
    
    return contentInfo;
  }
} 