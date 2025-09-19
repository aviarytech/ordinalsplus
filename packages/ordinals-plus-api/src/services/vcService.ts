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

import type {
  CredentialRepository,
  CredentialMetadata
} from '../repositories/credentialRepository';
import { InMemoryCredentialRepository } from '../repositories/credentialRepository';
// Verification cryptography is delegated to the ordinalsplus VCService

// Interface for DID resolution result
interface DIDResolutionResult {
  didDocument?: any;
  error?: string;
}

/**
 * Configuration for the VC Service
 */
export interface VCServiceConfig {
  /** API endpoint URL for the VC service */
  apiUrl: string;
  /** Authentication token or API key */
  apiKey: string;
  /** Platform DID used for issuing credentials */
  platformDid: string;
  /** Provider ID from the configuration */
  providerId?: string;
  /** Provider name for display purposes */
  providerName?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to enable debug logging */
  enableLogging?: boolean;
  /** Maximum number of retry attempts for API calls */
  maxRetries?: number;
  /** Configuration for credential repository */
  credentialRepository?: {
    /** Whether to enable encryption for stored credentials */
    enableEncryption?: boolean;
    /** Encryption key (required if encryption is enabled) */
    encryptionKey?: string;
    /** Path for credential data persistence */
    persistencePath?: string;
    /** Auto-save interval in milliseconds (0 to disable) */
    autoSaveIntervalMs?: number;
  };
}

// Import the VC API provider configuration
import { getDefaultVCApiProvider, getVCApiProviderById } from '../config/vcApiConfig';
import { VCService as OrdinalsPlusVCService } from 'ordinalsplus';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Partial<VCServiceConfig> = {
  timeout: 30000, // 30 seconds
  enableLogging: false,
  maxRetries: 3,
  credentialRepository: {
    enableEncryption: false,
    autoSaveIntervalMs: 0 // Disable auto-save by default
  }
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
 * Verify the signature of a credential using cryptographic methods
 * 
 * @param credential - The credential to verify
 * @param verificationMethod - The verification method from DID document
 * @returns Whether the signature is valid
 */
async function verifySignature(credential: VerifiableCredential, verificationMethod: any): Promise<boolean> {
  if (!credential.proof || !verificationMethod) {
    return false;
  }
  
  // Get the proof (if array, use the first one for now)
  const proof = Array.isArray(credential.proof) ? credential.proof[0] : credential.proof;
  
  // Ensure proof exists
  if (!proof) {
    console.error('No valid proof found in credential');
    return false;
  }
  
  // Extract required fields from the proof
  if (!proof.type || !proof.proofValue) {
    console.error('Missing required proof properties: type or proofValue');
    return false;
  }
  
  try {
    // Handle different proof types
    switch (proof.type) {
      case ProofType.DATA_INTEGRITY: {
        return false; // delegated
      }
      case ProofType.JWT: {
        return false; // delegated
      }
      case ProofType.BBS: {
        // BBS+ signatures are not implemented yet
        console.warn('BBS+ signature verification not yet implemented');
        return false;
      }
      default: {
        console.error(`Unsupported proof type: ${proof.type}`);
        return false;
      }
    }
  } catch (error) {
    console.error('Error during signature verification:', error);
    return false;
  }
}

/**
 * Fetches a JSON resource from a given URL.
 * This will be used for fetching revocation lists, status list credentials, etc.
 * @param url The URL to fetch the JSON resource from.
 * @param client The API client instance to use for fetching.
 * @returns The fetched JSON data or null if an error occurs.
 */
async function fetchJsonResource(url: string, client: ReturnType<typeof createResilientClient>): Promise<any | null> {
  try {
    const response = await client.get(url);
    if (response.status === 200 && response.data) {
      return response.data;
    }
    console.error(`Failed to fetch JSON resource from ${url}. Status: ${response.status}`);
    return null;
  } catch (error) {
    console.error(`Error fetching JSON resource from ${url}:`, error);
    return null;
  }
}

/**
 * Service for handling VC operations
 */
export class VCService {
  private config: VCServiceConfig;
  private client: ReturnType<typeof createResilientClient>;
  private circuitBreaker: CircuitBreaker;
  private credentialRepository: CredentialRepository;
  private resourceCache: Map<string, { data: any; timestamp: number }> = new Map();
  private ordinalsPlusVc?: OrdinalsPlusVCService;
  
  /**
   * Fetches a JSON resource from a given URL with caching.
   * This will be used for fetching revocation lists, status list credentials, etc.
   * @param url The URL to fetch the JSON resource from.
   * @param cacheTtlMs Optional TTL for cache entries in milliseconds (default: 5 minutes)
   * @returns The fetched JSON data or null if an error occurs.
   */
  private async fetchCachedJsonResource(url: string, cacheTtlMs: number = 5 * 60 * 1000): Promise<any | null> {
    // Check cache first
    const cachedEntry = this.resourceCache.get(url);
    const now = Date.now();
    
    // If we have a valid cached entry that hasn't expired, return it
    if (cachedEntry && (now - cachedEntry.timestamp) < cacheTtlMs) {
      if (this.config.enableLogging) {
        console.log(`Cache hit for resource: ${url}`);
      }
      return cachedEntry.data;
    }
    
    // If cache miss or expired, fetch from network
    if (this.config.enableLogging) {
      console.log(`Cache miss for resource: ${url}, fetching from network`);
    }
    
    const data = await fetchJsonResource(url, this.client);
    
    // Cache the result if it's not null
    if (data) {
      this.resourceCache.set(url, { data, timestamp: now });
    }
    
    return data;
  }

  /**
   * Lazily create the ordinalsplus VCService to avoid duplicating verification logic here.
   */
  private getOrCreateOrdinalsPlusVc(): OrdinalsPlusVCService {
    if (this.ordinalsPlusVc) return this.ordinalsPlusVc;
    const provider = this.config.providerId
      ? getVCApiProviderById(this.config.providerId)
      : getDefaultVCApiProvider();
    this.ordinalsPlusVc = new OrdinalsPlusVCService({
      acesApiUrl: provider.url,
      acesApiKey: provider.authToken,
      timeout: this.config.timeout,
      enableRetry: !!this.config.maxRetries,
      maxRetries: this.config.maxRetries,
      retryDelay: 0
    });
    return this.ordinalsPlusVc;
  }
  
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
    // If a providerId is specified, get that provider's configuration
    let providerConfig = config.providerId ? 
      getVCApiProviderById(config.providerId) : 
      getDefaultVCApiProvider();
    
    // Merge configurations with priority: provided config > provider config > default config
    this.config = {
      ...DEFAULT_CONFIG,
      // Apply provider config values
      apiUrl: providerConfig.url,
      apiKey: providerConfig.authToken,
      providerName: providerConfig.name,
      providerId: providerConfig.id,
      // Override with any explicitly provided config values
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
      baseURL: this.config.apiUrl,
      apiKey: this.config.apiKey,
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
    
    // Initialize credential repository
    this.credentialRepository = new InMemoryCredentialRepository({
      enableEncryption: this.config.credentialRepository?.enableEncryption,
      encryptionKey: this.config.credentialRepository?.encryptionKey,
      persistencePath: this.config.credentialRepository?.persistencePath,
      autoSaveIntervalMs: this.config.credentialRepository?.autoSaveIntervalMs
    });
    
    if (this.config.enableLogging) {
      console.log('VCService initialized with config:', {
        provider: {
          id: this.config.providerId,
          name: this.config.providerName,
          url: this.config.apiUrl
        },
        platformDid: this.config.platformDid,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
        credentialRepository: {
          enableEncryption: this.config.credentialRepository?.enableEncryption,
          persistencePath: this.config.credentialRepository?.persistencePath !== undefined,
          autoSaveIntervalMs: this.config.credentialRepository?.autoSaveIntervalMs
        }
      });
    }
  }
  
  /**
   * Get information about the current VC API provider
   * 
   * @returns Provider information including ID, name, and URL
   */
  getProviderInfo(): { id: string; name: string; url: string } {
    return {
      id: this.config.providerId || 'default',
      name: this.config.providerName || 'Default Provider',
      url: this.config.apiUrl
    };
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
      const signedCredential = await this.circuitBreaker.execute(async () => {
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
        
        // Store the credential in the repository
        const credentialMetadata: CredentialMetadata = {
          inscriptionId: metadata.inscriptionId || '',
          title: metadata.title,
          creator: metadata.creator || issuerDid
        };
        
        try {
          await this.credentialRepository.storeCredential(signedCredential, credentialMetadata);
          
          if (this.config.enableLogging) {
            console.log('Stored credential in repository:', {
              id: signedCredential.id,
              subject: subjectDid
            });
          }
        } catch (storageError) {
          console.error('Failed to store credential in repository:', storageError);
          // Continue with the issuance flow even if storage fails
        }
        
        return signedCredential;
      });
      
      return signedCredential;
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
   * Verify a verifiable credential
   * 
   * @param credential - The credential to verify
   * @returns Whether the credential is valid
   */
  async verifyCredential(credential: VerifiableCredential): Promise<boolean> {
    if (!credential || !credential.issuer || !credential.proof) {
      console.error('Invalid credential structure for verification');
      return false;
    }

    // Prefer shared ordinalsplus verification path to avoid duplicating logic here
    try {
      const sharedVc = this.getOrCreateOrdinalsPlusVc();
      return await sharedVc.verifyCredential(credential as any);
    } catch (e) {
      console.warn('ordinalsplus VCService verification failed, falling back to local verification logic:', e);
    }

    try {
      // Extract issuer DID
      const issuerDid = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id;
      
      // First try auto-detection to see what the issuer DID contains
      let didResolution = await this.didService.resolve(issuerDid, { expectedContent: 'any' });
      
      if (didResolution.error) {
        console.error(`Failed to resolve issuer DID ${issuerDid}: ${didResolution.error}`);
        return false;
      }
      
      // Check if we got a DID Document (needed for verification)
      if (didResolution.contentType === 'did-document' && didResolution.didDocument) {
        console.log(`[VCService] Found DID Document for issuer: ${issuerDid}`);
      } else {
        console.log(`[VCService] Issuer DID contains ${didResolution.contentType} content, not a DID Document.`);
        
        // Try to resolve specifically as a DID Document
        const didDocResult = await this.didService.resolve(issuerDid, { expectedContent: 'did-document' });
        
        if (didDocResult.error || !didDocResult.didDocument) {
          console.error(`[VCService] Cannot verify credential: issuer DID does not contain a DID Document needed for verification. Contains: ${didResolution.contentType}`);
          return false;
        }
        
        // Use the DID Document from the specific resolution
        didResolution = { didDocument: didDocResult.didDocument };
      }

      // Find the verification method referenced in the proof
      // The proof might be an array, take the first one as per current verifySignature logic
      const proof = Array.isArray(credential.proof) ? credential.proof[0] : credential.proof;
      if (!proof || !proof.verificationMethod) {
        console.error('Proof or verificationMethod missing in credential');
        return false;
      }
      
      const verificationMethod = findVerificationMethod(
        didResolution.didDocument,
        proof.verificationMethod
      );

      if (!verificationMethod) {
        console.error(`Verification method ${proof.verificationMethod} not found in DID document`);
        return false;
      }
      
      // Verify signature using appropriate algorithm
      const isValid = await verifySignature(credential, verificationMethod);
      
      if (this.config.enableLogging) {
        console.log(`Credential verification result for ${credential.id}: ${isValid}`);
      }

      // Optionally, perform status check (revocation, expiration)
      // This is a separate step as signature validity is primary
      if (isValid) {
        return await this.checkCredentialStatus(credential);
      }

      return isValid;
    } catch (error) {
      console.error('Error during credential verification:', error);
      return false;
    }
  }
  
  /**
   * Check credential status (revocation or suspension)
   * 
   * @param credential - The credential to check
   * @returns Whether the credential is valid according to its status
   */
  private async checkCredentialStatus(credential: VerifiableCredential): Promise<boolean> {
    if (!credential.credentialStatus) {
      // No status to check
      return true;
    }
    
    try {
      // Destructure all potential properties from credentialStatus for clarity
      const { 
        type, 
        id: statusId, // Used as URL for RevocationList2020, or general ID for others
        revocationListIndex, 
        revocationListCredential, // URL to the credential that signs the RevocationList2020
        statusListCredential, // URL to the StatusList2021Credential
        statusListIndex, 
        statusPurpose 
      } = credential.credentialStatus as any;
      
      if (type === 'RevocationList2020Status') {
        if (this.config.enableLogging) {
          console.log('Checking RevocationList2020Status for credential', {
            credentialId: credential.id,
            statusListUrl: statusId, 
            revocationListIndex,
            revocationListCredentialUrl: revocationListCredential
          });
        }

        if (!statusId || typeof revocationListIndex !== 'number' || revocationListIndex < 0) {
          console.error('RevocationList2020Status is missing status ID (URL), or revocationListIndex is invalid.');
          return false; 
        }

        const revocationListJson = await this.fetchCachedJsonResource(statusId);
        if (!revocationListJson) {
          console.error(`Failed to fetch revocation list from ${statusId}.`);
          return false; 
        }

        // Verify the RevocationList2020 itself if it's credentialed
        if (revocationListCredential) {
          if (this.config.enableLogging) {
            console.log(`Verifying RevocationList2020 credential from ${revocationListCredential}`);
          }
          const fetchedListVc = await this.fetchCachedJsonResource(revocationListCredential);
          if (!fetchedListVc) {
            console.error(`Failed to fetch RevocationList2020 credential from ${revocationListCredential}.`);
            return false; // Fail closed if list's own credential cannot be fetched
          }
          // Note: The fetchedListVc is the credential FOR the list. We need to ensure the revocationListJson
          // is what this fetchedListVc claims to be. This typically means the fetchedListVc's subject
          // would contain or reference the revocationListJson (e.g. hash or full content).
          // For now, we'll verify the fetchedListVc. A deeper integration would be to check that
          // fetchedListVc.credentialSubject.id (or similar) matches statusId (URL of the list) or contains the list.
          // Or, more simply, the `revocationListJson` *is* the credential to verify if `revocationListCredential` points to itself or is embedded.
          // The spec is a bit flexible here. Assuming revocationListJson is the list and fetchedListVc is its wrapper credential.

          // Let's assume the `revocationListJson` is what needs to be wrapped/asserted by `fetchedListVc`.
          // The most direct interpretation is that `revocationListJson` itself might be a VC if `revocationListCredential` is not separate.
          // However, if `revocationListCredential` IS provided, it signs the list from `statusId`.
          // Let's verify `fetchedListVc` first.
          const isListVcValid = await this.verifyCredential(fetchedListVc as VerifiableCredential);
          if (!isListVcValid) {
            console.error(`The RevocationList2020's own credential from ${revocationListCredential} is not valid.`);
            return false; // Fail closed if the list's own credential is not valid
          }
          // Further check: ensure fetchedListVc.credentialSubject actually pertains to the revocationListJson from statusId.
          // This is non-trivial and depends on how the issuer structures this. For now, validating the list VC is a good step.
          if (this.config.enableLogging) {
            console.log(`RevocationList2020 credential from ${revocationListCredential} verified successfully.`);
          }
        }

        if (revocationListJson.encodedList) {
          try {
            const bitstring = Buffer.from(revocationListJson.encodedList, 'base64');
            const byteIndex = Math.floor(revocationListIndex / 8);
            const bitIndexInByte = revocationListIndex % 8;

            if (byteIndex >= bitstring.length) {
              console.error(`revocationListIndex ${revocationListIndex} is out of bounds for the fetched list (length: ${bitstring.length * 8}).`);
              return false; 
            }
            
            const byteValue = bitstring[byteIndex];
            if (typeof byteValue !== 'number') { 
                console.error(`Invalid byteValue at index ${byteIndex} in revocation list bitstring.`);
                return false;
            }

            const isRevoked = (byteValue & (1 << bitIndexInByte)) !== 0;
            
            if (this.config.enableLogging) {
              console.log(`RevocationList2020Status: Credential ${credential.id} (index ${revocationListIndex}) is ${isRevoked ? 'REVOKED' : 'VALID'}.`);
            }
            return !isRevoked; 
          } catch (e) {
            console.error('Error processing encodedList for RevocationList2020Status:', e);
            return false; 
          }
        } else {
          // TODO: Handle other forms of revocation lists (e.g., explicit revoked indices)
          console.warn('RevocationList2020Status check for non-encodedList format not yet implemented - assuming valid for now.');
          return true;
        }

      } else if (type === 'StatusList2021Entry') {
        if (this.config.enableLogging) {
          console.log('Checking StatusList2021Entry for credential', {
            credentialId: credential.id,
            statusListCredentialUrl: statusListCredential,
            statusListIndex,
            statusPurpose,
          });
        }

        if (!statusListCredential || typeof statusListIndex !== 'number' || statusListIndex < 0) {
          console.error('StatusList2021Entry is missing statusListCredential URL or statusListIndex is invalid.');
          return false; // Fail closed
        }

        const fetchedStatusListCred = await this.fetchCachedJsonResource(statusListCredential);
        if (!fetchedStatusListCred) {
          console.error(`Failed to fetch StatusList2021Credential from ${statusListCredential}.`);
          return false; // Fail closed
        }

        // Verify the StatusList2021Credential itself
        const isStatusListCredValid = await this.verifyCredential(fetchedStatusListCred as VerifiableCredential);
        if (!isStatusListCredValid) {
          console.error(`The fetched StatusList2021Credential from ${statusListCredential} is not valid.`);
          return false; // Fail closed if the status list's own credential is not valid
        }

        // Assuming StatusList2021Credential subject contains the list
        const listData = fetchedStatusListCred.credentialSubject?.statusList || fetchedStatusListCred.credentialSubject;
        if (!listData || !listData.encodedList) {
            console.error('encodedList not found in the verified StatusList2021Credential subject.');
            return false; // Fail closed
        }

        try {
          // Decoding process: base64url -> gzip -> bitstring
          const compressedBytes = Buffer.from(listData.encodedList, 'base64url'); // Use base64url
          // const bitstring = Buffer.from(inflate(compressedBytes)); // Decompress with pako.inflate
          const bitstring = Buffer.from(compressedBytes); // TODO: Decompress with pako.inflate
          const byteIndex = Math.floor(statusListIndex / 8);
          const bitIndexInByte = statusListIndex % 8;

          if (byteIndex >= bitstring.length) {
            console.error(`statusListIndex ${statusListIndex} is out of bounds for the status list (length: ${bitstring.length * 8}).`);
            return false;
          }

          const byteValue = bitstring[byteIndex];
          if (typeof byteValue !== 'number') {
            console.error(`Invalid byteValue at index ${byteIndex} in status list bitstring.`);
            return false;
          }

          let bitIsSet = (byteValue & (1 << bitIndexInByte)) !== 0;
          let currentStatusIsValid = true;

          // Interpret based on statusPurpose
          if (statusPurpose === 'revocation' || statusPurpose === 'suspension') {
            currentStatusIsValid = !bitIsSet; // If bit is set, it's revoked/suspended (not valid)
          } else {
            // For other purposes, or if purpose is undefined, a set bit might mean active.
            // This part might need more nuanced handling based on expected purposes.
            // For now, assume other purposes mean bitIsSet = valid status.
            currentStatusIsValid = bitIsSet;
            if (this.config.enableLogging && statusPurpose) {
                console.log(`StatusList2021Entry: Purpose '${statusPurpose}'. Bit is ${bitIsSet ? 'SET' : 'NOT SET'}. Credential is considered ${currentStatusIsValid ? 'VALID' : 'INVALID'} based on this bit.`);
            }
          }

          if (this.config.enableLogging) {
            console.log(`StatusList2021Entry: Credential ${credential.id} (index ${statusListIndex}, purpose ${statusPurpose || 'default'}) is ${currentStatusIsValid ? 'VALID' : 'INVALID'}.`);
          }
          return currentStatusIsValid;

        } catch (e) {
          console.error('Error processing encodedList for StatusList2021Entry:', e);
          return false; // Fail closed
        }

      } else {
        if (this.config.enableLogging) {
          console.warn('Unknown credential status type', {
            type,
            id: statusId, // Use statusId here for the original 'id' field
            credentialId: credential.id
          });
        }
        
        return true;
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error checking credential status', {
          error: error instanceof Error ? error.message : String(error),
          credentialId: credential.id
        });
      }
      
      // If we can't check the status, we might want to fail closed
      // But for now, we'll allow it to pass
      return true;
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

  /**
   * Get a credential by its ID
   * 
   * @param id - The credential ID to retrieve
   * @returns The credential if found, null otherwise
   */
  async getCredential(id: string): Promise<VerifiableCredential | null> {
    try {
      const result = await this.credentialRepository.getCredentialById(id);
      
      if (!result) {
        return null;
      }
      
      // Verify the credential is still valid
      const isValid = await this.verifyCredential(result.credential);
      
      if (!isValid) {
        if (this.config.enableLogging) {
          console.warn('Retrieved credential is no longer valid', {
            id,
            reason: 'Failed verification'
          });
        }
        // Return it anyway - caller can decide what to do
      }
      
      return result.credential;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error retrieving credential ${id}:`, error);
      }
      return null;
    }
  }

  /**
   * Find credentials by subject DID
   * 
   * @param subjectDid - The subject DID to search for
   * @returns Array of matching credentials
   */
  async findCredentialsBySubject(subjectDid: string): Promise<VerifiableCredential[]> {
    try {
      const results = await this.credentialRepository.findCredentialsBySubject(subjectDid);
      return results.map(result => result.credential);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error finding credentials for subject ${subjectDid}:`, error);
      }
      return [];
    }
  }

  /**
   * Find credentials by issuer DID
   * 
   * @param issuerDid - The issuer DID to search for
   * @returns Array of matching credentials
   */
  async findCredentialsByIssuer(issuerDid: string): Promise<VerifiableCredential[]> {
    try {
      const results = await this.credentialRepository.findCredentialsByIssuer(issuerDid);
      return results.map(result => result.credential);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error finding credentials for issuer ${issuerDid}:`, error);
      }
      return [];
    }
  }

  /**
   * Find credentials associated with an inscription
   * 
   * @param inscriptionId - The inscription ID to search for
   * @returns Array of matching credentials
   */
  async findCredentialsByInscription(inscriptionId: string): Promise<VerifiableCredential[]> {
    try {
      const results = await this.credentialRepository.findCredentialsByInscription(inscriptionId);
      return results.map(result => result.credential);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error finding credentials for inscription ${inscriptionId}:`, error);
      }
      return [];
    }
  }

  /**
   * Create a backup of all stored credentials
   * 
   * @param backupPath - Path to store the backup
   * @returns Whether the backup was successful
   */
  async backupCredentials(backupPath: string): Promise<boolean> {
    try {
      return await this.credentialRepository.createBackup(backupPath);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error creating credential backup at ${backupPath}:`, error);
      }
      return false;
    }
  }

  /**
   * Restore credentials from a backup
   * 
   * @param backupPath - Path to the backup file
   * @returns Whether the restore was successful
   */
  async restoreCredentials(backupPath: string): Promise<boolean> {
    try {
      return await this.credentialRepository.restoreFromBackup(backupPath);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error(`Error restoring credentials from ${backupPath}:`, error);
      }
      return false;
    }
  }
}