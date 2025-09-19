/**
 * Verifiable Credential Service
 * 
 * This module provides a high-level service for managing verifiable credentials
 * using the Aces VC API client and integrating with the DID service.
 */

import { BtcoDidResolver } from '../did';
import { ResourceProvider } from '../resources/providers/types';
import { StaticDataProvider, StaticSatData } from '../resources/providers/static-data-provider';
import { createDocumentLoader, Verifier } from 'di-wings';
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
  VC_CONTEXTS,
  calculateContentHash
} from './formatters';
import { validateCredential } from './validators';

/**
 * Configuration for the VC service
 */
export interface VCServiceConfig {
  /** Base URL for the Aces API */
  acesApiUrl?: string;
  
  /** API key for Aces API authentication */
  acesApiKey?: string;
  
  /** Platform-wide DID used for certain operations */
  platformDid?: string;
  
  /** Optional resource provider for DID resolution (e.g., StaticDataProvider for pre-fetched data) */
  resourceProvider?: ResourceProvider;
  
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
  private apiClient?: AcesApiClient;
  private didResolver: BtcoDidResolver;
  private config: VCServiceConfig;
  
  /**
   * Creates a new VCService instance
   * 
   * @param config - Service configuration including optional resource provider
   */
  constructor(config: VCServiceConfig) {
    this.config = {
      defaultProofType: ProofType.DATA_INTEGRITY,
      ...config
    };
    
    // Create DID resolver with optional provider
    this.didResolver = new BtcoDidResolver(
      config.resourceProvider ? { provider: config.resourceProvider } : {}
    );

    if (this.config.acesApiUrl && this.config.acesApiKey) {
      this.apiClient = new AcesApiClient({
        apiUrl: this.config.acesApiUrl,
        apiKey: this.config.acesApiKey,
        timeout: this.config.timeout,
        enableRetry: this.config.enableRetry,
        maxRetries: this.config.maxRetries,
        retryDelay: this.config.retryDelay
      });
    }
  }

  /**
   * Creates a new VCService instance with static/pre-fetched data
   * Useful for frontend applications or when working with cached data
   * 
   * @param config - Service configuration (without resourceProvider)
   * @param staticSatData - Pre-fetched sat and inscription data
   * @returns VCService instance configured with static data
   */
  static withStaticData(
    config: Omit<VCServiceConfig, 'resourceProvider'>,
    staticSatData: StaticSatData[]
  ): VCService {
    const staticProvider = new StaticDataProvider(staticSatData);
    
    return new VCService({
      ...config,
      resourceProvider: staticProvider
    });
  }

  /**
   * Add static data to an existing service (if using StaticDataProvider)
   * 
   * @param staticSatData - Additional sat data to load
   */
  addStaticData(staticSatData: StaticSatData[]): void {
    // Get the current provider from the did resolver
    const provider = (this.didResolver as any).options?.provider;
    
    if (provider instanceof StaticDataProvider) {
      provider.loadSatData(staticSatData);
    } else {
      console.warn('Cannot add static data: service is not using StaticDataProvider');
    }
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
   * Creates a custom document loader that uses our static data provider
   * instead of making external API calls for DID resolution
   */
  private createCustomDocumentLoader() {
    const defaultDocumentLoader = createDocumentLoader();
    
    return async (url: string) => {
      // Check if this is a DID URL
      if (url.startsWith('did:btco')) {
        try {
          console.log(`[VCService] Custom document loader resolving DID: ${url}`);
          
          // Parse the DID URL to separate base DID from fragment
          const [baseDid, fragment] = url.split('#');
          
          // Use our configured DID resolver (which may have a StaticDataProvider)
          const didResolution = await this.didResolver.resolve(baseDid);
          
          if (didResolution.didDocument) {
            console.log(`[VCService] Successfully resolved DID via static data: ${baseDid}`);
            
            // If there's a fragment, try to resolve it to a specific verification method
            if (fragment) {
              console.log(`[VCService] Looking for fragment ${fragment} in DID document`);
              
              // Look for the verification method with the matching ID
              const verificationMethod = didResolution.didDocument.verificationMethod?.find(
                vm => vm.id === url || vm.id === `${baseDid}#${fragment}` || vm.id.endsWith(`#${fragment}`)
              );
              
              if (verificationMethod) {
                console.log(`[VCService] Found verification method for fragment ${fragment}`);
                return {
                  contextUrl: null,
                  document: verificationMethod,
                  documentUrl: url
                };
              } else {
                console.log(`[VCService] Fragment ${fragment} not found in verification methods, returning full document`);
                // If fragment not found, return the full document
                // The verifier will handle finding the right verification method
                return {
                  contextUrl: null,
                  document: didResolution.didDocument,
                  documentUrl: url
                };
              }
            } else {
              // No fragment, return the full DID document
              return {
                contextUrl: null,
                document: didResolution.didDocument,
                documentUrl: url
              };
            }
          } else {
            console.log(`[VCService] No DID document found for: ${baseDid}`);
            // Fall back to default loader if our static data doesn't have it
            return await defaultDocumentLoader(url);
          }
        } catch (error) {
          console.warn(`[VCService] Error resolving DID ${url} via static data, falling back to default loader:`, error);
          // Fall back to default loader on error
          return await defaultDocumentLoader(url);
        }
      }
      
      // For non-DID URLs, use the default document loader
      return await defaultDocumentLoader(url);
    };
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
    if (didResolution.resolutionMetadata.error) {
      throw new Error(`Invalid issuer DID: ${didResolution.resolutionMetadata.error}`);
    }

    // Ensure contentInfo is provided
    if (!contentInfo) {
      throw new Error('Content info is required for credential issuance');
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
      if (!this.apiClient) {
        throw new Error('API client not configured. Provide acesApiUrl and acesApiKey in config.');
      }
      
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
   * @param satNumber - Optional sat number being verified (to validate credential is about this sat)
   * @returns Whether the credential is valid
   */
  async verifyCredential(credential: VerifiableCredential, satNumber?: string): Promise<boolean> {
    // First perform local validation of the credential structure
    console.log(`[VCService] Verifying credential: ${JSON.stringify(credential)}`);
    const validationResult = validateCredential(credential);
    if (!validationResult.valid) {
      const errorMessages = validationResult.errors ? validationResult.errors.join(', ') : 'Unknown validation error';
      console.error('Credential validation failed:', errorMessages);
      return false;
    }
    
    // Extract issuer DID and credential subject ID
    const issuerDid = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id;
    const subjectId = Array.isArray(credential.credentialSubject) 
      ? credential.credentialSubject[0]?.id 
      : credential.credentialSubject.id;
    
    // Validate that the credential subject matches the sat being verified
    if (satNumber && subjectId && subjectId.startsWith('did:btco')) {
      const subjectSatNumber = this.extractSatNumberFromDid(subjectId);
      
      if (!subjectSatNumber) {
        console.error('Failed to extract sat number from credential subject DID:', subjectId);
        return false;
      }
      
      if (subjectSatNumber !== satNumber) {
        console.error(`Sat mismatch: credential is about sat ${subjectSatNumber} but verifying sat ${satNumber}`);
        return false;
      }
      
      console.log(`[VCService] Sat validation passed: credential subject references sat ${subjectSatNumber} which matches verification target`);
    }
    
    // Resolve the issuer DID to get verification method
    const didResolution = await this.didResolver.resolve(issuerDid);
    console.log('didResolution', didResolution);
    if (didResolution.resolutionMetadata.error) {
      console.error('Failed to resolve issuer DID:', didResolution.resolutionMetadata.error);
      return false;
    }
    
    // If the credential doesn't have a proof, it can't be verified
    if (!credential.proof) {
      console.error('Credential has no proof');
      return false;
    }
    
    try {
      const verifier = new Verifier();
      const verificationResult = await verifier.verifyCredential(credential as any, { documentLoader: this.createCustomDocumentLoader() });
      
      console.log(`[VCService] di-wings verification result:`, verificationResult.verified);
      
      if (!verificationResult.verified) {
        console.error('di-wings verification failed:', verificationResult.errors);
        return false;
      }
    } catch (error: unknown) {
      console.error('di-wings verification error:', error);
      return false;
    }
    
    return true;
  }

  /**
   * Extract sat number from a BTCO DID
   * @param did - The DID (e.g., "did:btco:sig:123456789")
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
  
  /**
   * Revokes a previously issued credential
   * 
   * @param credentialId - ID of the credential to revoke
   * @param issuerDid - DID of the issuer
   * @param reason - Optional reason for revocation
   * @returns Whether the revocation was successful
   */
  async revokeCredential(credentialId: string, issuerDid: string, reason?: string): Promise<boolean> {
    if (!this.apiClient) {
      throw new Error('API client not configured. Provide acesApiUrl and acesApiKey in config.');
    }
    
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
    if (!this.apiClient) {
      throw new Error('API client not configured. Provide acesApiUrl and acesApiKey in config.');
    }
    
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
      hash: await calculateContentHash(content),
      size: content.length
    };
    
    if (dimensions) {
      contentInfo.dimensions = dimensions;
    }
    
    return contentInfo;
  }
} 