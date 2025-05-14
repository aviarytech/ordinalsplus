/**
 * Verifiable Credential Service
 * 
 * This module provides a service for issuing and verifying W3C Verifiable Credentials
 * via the Aces API, with robust error handling, retries, and circuit breaker patterns.
 */
import { DIDService } from './didService';
import {
  createResilientClient,
  withRetry,
  ApiError,
  NetworkError,
  ServerError,
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_OPTIONS,
  DEFAULT_RETRY_OPTIONS
} from '../utils/apiUtils';

import {
  VC_CONTEXTS,
  VC_TYPES,
  ProofType
} from '../types/verifiableCredential';

import type {
  VerifiableCredential,
  CredentialIssuanceParams,
  ContentInfo,
  CredentialProof
} from '../types/verifiableCredential';

// Interface for DID resolution result
interface DIDResolutionResult {
  didDocument?: any;
  error?: string;
}

/**
 * Configuration for the VC Service
 */
export interface VCServiceConfig {
  /** Aces API URL */
  acesApiUrl: string;
  /** Aces API key */
  acesApiKey: string;
  /** Platform DID */
  platformDid: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to enable logging */
  enableLogging?: boolean;
  /** Maximum retries for API calls */
  maxRetries?: number;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<VCServiceConfig> = {
  timeout: 30000,
  enableLogging: true,
  maxRetries: 3
};

/**
 * Find a verification method in a DID document
 */
function findVerificationMethod(didDocument: any, verificationMethodId: string): any {
  if (!didDocument || !didDocument.verificationMethod) {
    return null;
  }

  // Check direct match in verificationMethod array
  const directMatch = didDocument.verificationMethod.find(
    (vm: any) => vm.id === verificationMethodId
  );
  
  if (directMatch) {
    return directMatch;
  }

  // Check in other verification relationships
  const relationshipProperties = [
    'assertionMethod',
    'authentication',
    'keyAgreement',
    'capabilityInvocation',
    'capabilityDelegation'
  ];

  for (const prop of relationshipProperties) {
    if (!didDocument[prop]) continue;

    // Handle both array of strings and array of objects
    for (const item of didDocument[prop]) {
      if (typeof item === 'string' && item === verificationMethodId) {
        // If it's a reference, we need to look it up in verificationMethod
        return didDocument.verificationMethod.find(
          (vm: any) => vm.id === verificationMethodId
        );
      } else if (typeof item === 'object' && item.id === verificationMethodId) {
        return item;
      }
    }
  }

  return null;
}

/**
 * Mock implementation of verifySignature 
 * (To be replaced with actual cryptographic verification)
 */
function verifySignature(credential: VerifiableCredential, verificationMethod: any): boolean {
  // This is a placeholder - in a real implementation, this would:
  // 1. Extract the public key from the verification method
  // 2. Parse the credential proof
  // 3. Verify the signature cryptographically based on the proof type
  
  // For now, return true (assume verification passes) if verification method exists
  return !!verificationMethod;
}

/**
 * Service for handling VC operations
 */
export class VCService {
  private config: VCServiceConfig;
  private client: ReturnType<typeof createResilientClient>;
  private circuitBreaker: CircuitBreaker;
  
  /**
   * Create a new VCService instance
   * 
   * @param didService - DID service for resolving DIDs
   * @param config - Service configuration
   */
  constructor(
    private didService: DIDService,
    config: Partial<VCServiceConfig>
  ) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config
    } as VCServiceConfig;
    
    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_OPTIONS,
      failureThreshold: 3,
      resetTimeout: 60000 // 1 minute
    });
    
    // Create resilient API client
    this.client = createResilientClient({
      baseURL: this.config.acesApiUrl,
      apiKey: this.config.acesApiKey,
      timeout: this.config.timeout,
      retry: {
        ...DEFAULT_RETRY_OPTIONS,
        maxRetries: this.config.maxRetries || 3,
        onRetry: (retryCount, error, delayMs) => {
          console.warn(`Retrying credential API call (${retryCount}/${this.config.maxRetries}) after ${delayMs}ms due to: ${error.message}`);
        }
      },
      circuitBreaker: {
        failureThreshold: 3,
        resetTimeout: 60000 // 1 minute
      }
    });
    
    if (this.config.enableLogging) {
      console.log('VCService initialized with config:', {
        acesApiUrl: this.config.acesApiUrl,
        platformDid: this.config.platformDid,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries
      });
    }
  }
  
  /**
   * Issue a verifiable credential
   * 
   * @param params - Credential issuance parameters
   * @returns The issued verifiable credential
   * @throws ApiError if issuance fails
   */
  async issueCredential(params: CredentialIssuanceParams): Promise<VerifiableCredential> {
    const { subjectDid, issuerDid, metadata, contentInfo } = params;
    
    // Prepare credential data
    const credentialData = {
      '@context': [
        VC_CONTEXTS.CORE_V2,
        VC_CONTEXTS.ORDINALS_PLUS
      ],
      'type': [VC_TYPES.VERIFIABLE_CREDENTIAL, VC_TYPES.VERIFIABLE_COLLECTIBLE],
      'issuer': { 'id': issuerDid },
      'credentialSubject': {
        'id': subjectDid,
        'type': 'Collectible',
        'title': metadata.title,
        'description': metadata.description,
        'creator': metadata.creator || issuerDid,
        'creationDate': metadata.creationDate || new Date().toISOString().split('T')[0],
        'properties': {
          'medium': 'Digital',
          'format': contentInfo.mimeType,
          'dimensions': contentInfo.dimensions,
          'contentHash': contentInfo.hash
        },
        // Add any additional attributes
        ...(metadata.attributes || {})
      },
      'issuanceDate': new Date().toISOString()
    };
    
    try {
      // Use circuit breaker to protect against failures
      return await this.circuitBreaker.execute(async () => {
        // Log credential preparation
        if (this.config.enableLogging) {
          console.log('Preparing to issue credential:', {
            subject: subjectDid,
            issuer: issuerDid,
            title: metadata.title
          });
        }
        
        // Call Aces API to issue credential with retry capability
        const response = await this.client.post('/issueCredential', {
          credential: credentialData,
          issuerDid: issuerDid
        });
        
        // Retrieve the signed credential from response
        const signedCredential = response.data.data || response.data;
        
        // Verify returned credential
        const isValid = await this.verifyCredential(signedCredential);
        
        if (!isValid) {
          if (this.config.enableLogging) {
            console.error('Issued credential verification failed', signedCredential);
          }
          throw new ApiError('Issued credential verification failed', 'VERIFICATION_FAILED');
        }
        
        if (this.config.enableLogging) {
          console.log('Successfully issued credential:', {
            id: signedCredential.id,
            subject: subjectDid,
            issuer: issuerDid
          });
        }
        
        return signedCredential;
      });
    } catch (error) {
      let message = 'Failed to issue credential';
      
      // Handle different error types
      if (error instanceof NetworkError) {
        message = `Network error issuing credential: ${error.message}`;
      } else if (error instanceof ServerError) {
        message = `Aces API server error: ${error.message}`;
      } else if (error instanceof ApiError) {
        message = `API error issuing credential: ${error.message}`;
      } else if (error instanceof Error) {
        message = `Error issuing credential: ${error.message}`;
      }
      
      // Log the error
      if (this.config.enableLogging) {
        console.error(message, {
          subjectDid,
          issuerDid,
          error
        });
      }
      
      // Rethrow to the caller with appropriate context
      throw new ApiError(message, 'CREDENTIAL_ISSUANCE_ERROR', error);
    }
  }
  
  /**
   * Verify a credential's signature
   * 
   * @param credential - Credential to verify
   * @returns Whether the credential signature is valid
   */
  async verifyCredential(credential: VerifiableCredential): Promise<boolean> {
    try {
      // Ensure credential has proper format
      if (!credential.proof) {
        throw new Error('Credential has no proof');
      }
      
      // Handle both single proof and array of proofs
      const proofs = Array.isArray(credential.proof) 
        ? credential.proof 
        : [credential.proof];
      
      // For now, we just verify the first proof
      const proof = proofs[0];
      if (!proof) {
        throw new Error('No proof available in credential');
      }
      
      // Resolve issuer DID to get verification method
      const issuerDid = credential.issuer.id;
      
      // Use retry logic for DID resolution to handle network issues
      const didResolution = await withRetry<DIDResolutionResult>(
        () => this.didService.resolveDID(issuerDid),
        {
          maxRetries: 2,
          initialDelay: 500
        }
      );
      
      if (didResolution.error) {
        if (this.config.enableLogging) {
          console.error('Failed to resolve issuer DID', {
            did: issuerDid,
            error: didResolution.error
          });
        }
        return false;
      }
      
      // Extract verification method from DID Document
      const verificationMethod = findVerificationMethod(
        didResolution.didDocument,
        proof.verificationMethod
      );
      
      if (!verificationMethod) {
        if (this.config.enableLogging) {
          console.error('Verification method not found in DID Document', {
            did: issuerDid,
            verificationMethod: proof.verificationMethod,
            didDocument: didResolution.didDocument
          });
        }
        return false;
      }
      
      // Verify signature using appropriate algorithm
      const isValid = verifySignature(credential, verificationMethod);
      
      if (this.config.enableLogging) {
        if (isValid) {
          console.log('Credential successfully verified', {
            id: credential.id,
            issuer: issuerDid
          });
        } else {
          console.error('Credential verification failed', {
            id: credential.id,
            issuer: issuerDid,
            proof
          });
        }
      }
      
      return isValid;
    } catch (error) {
      // Log verification errors
      if (this.config.enableLogging) {
        console.error('Error verifying credential', {
          credentialId: credential.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      return false;
    }
  }
  
  /**
   * Check the health of the Aces API
   * 
   * @returns Whether the API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200 && response.data?.status === 'ok';
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Aces API health check failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
      return false;
    }
  }
} 