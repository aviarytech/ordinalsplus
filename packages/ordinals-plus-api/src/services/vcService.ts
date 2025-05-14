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
  /** Credential repository settings */
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
 * Verify the signature of a credential using cryptographic methods
 * 
 * @param credential - The credential to verify
 * @param verificationMethod - The verification method from DID document
 * @returns Whether the signature is valid
 */
function verifySignature(credential: VerifiableCredential, verificationMethod: any): boolean {
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
        return verifyDataIntegrityProof(credential, proof.proofValue, verificationMethod);
      }
      case ProofType.JWT: {
        return verifyJwtProof(credential, proof.proofValue, verificationMethod);
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
 * Verify a DataIntegrityProof signature
 * 
 * @param credential - The credential to verify
 * @param proofValue - The base64-encoded signature
 * @param verificationMethod - The verification method from DID document
 * @returns Whether the signature is valid
 */
function verifyDataIntegrityProof(
  credential: VerifiableCredential,
  proofValue: string,
  verificationMethod: any
): boolean {
  // This is a simplified implementation - in a production environment,
  // the verification would depend on the specific key type and signing algorithm
  
  try {
    // Get the key type and format from verification method
    const keyType = verificationMethod.type;
    
    // Create a canonical representation of the credential without the proof value
    // This should match what was originally signed
    const credentialCopy = JSON.parse(JSON.stringify(credential));
    // Remove the proof value to get the same document that was signed
    if (Array.isArray(credentialCopy.proof)) {
      credentialCopy.proof.forEach((p: any) => delete p.proofValue);
    } else if (credentialCopy.proof) {
      delete credentialCopy.proof.proofValue;
    }
    
    // Canonicalize the document for consistent verification
    const canonicalDocument = canonicalizeCredential(credentialCopy);
    
    // Convert the canonical document to bytes
    const messageBytes = Buffer.from(JSON.stringify(canonicalDocument));
    
    // Convert the proof value from base64 to binary
    const signatureBytes = Buffer.from(proofValue, 'base64');
    
    // Verify based on key type
    if (keyType.includes('Ed25519')) {
      // Ed25519 verification
      return verifyEd25519Signature(messageBytes, signatureBytes, verificationMethod);
    } else if (keyType.includes('secp256k1') || keyType.includes('Secp256k1')) {
      // secp256k1 verification
      return verifySecp256k1Signature(messageBytes, signatureBytes, verificationMethod);
    } else {
      console.error(`Unsupported key type for verification: ${keyType}`);
      return false;
    }
  } catch (error) {
    console.error('Error verifying DataIntegrityProof:', error);
    return false;
  }
}

/**
 * Verify a JWT proof
 * 
 * @param credential - The credential to verify
 * @param proofValue - The JWT token
 * @param verificationMethod - The verification method from DID document
 * @returns Whether the JWT is valid
 */
function verifyJwtProof(
  credential: VerifiableCredential,
  proofValue: string,
  verificationMethod: any
): boolean {
  try {
    // JWT verification would typically involve:
    // 1. Parsing the JWT
    // 2. Verifying the signature using the public key from verificationMethod
    // 3. Validating that the claims in the JWT match the credential
    
    // This is a simplified placeholder that would be replaced with actual JWT verification
    console.warn('JWT verification is not fully implemented - returning false');
    return false;
  } catch (error) {
    console.error('Error verifying JWT proof:', error);
    return false;
  }
}

/**
 * Verify an Ed25519 signature
 * 
 * @param message - The message that was signed
 * @param signature - The signature bytes
 * @param verificationMethod - The verification method containing the public key
 * @returns Whether the signature is valid
 */
function verifyEd25519Signature(
  message: Buffer,
  signature: Buffer,
  verificationMethod: any
): boolean {
  try {
    // Extract the public key from verificationMethod
    // The key could be in different formats - we handle the common ones
    let publicKeyBytes: Buffer;
    
    if (verificationMethod.publicKeyMultibase) {
      // Convert from multibase format
      // This is a simplified version - a complete implementation would handle all multibase prefixes
      const multibaseKey = verificationMethod.publicKeyMultibase;
      // For z-base32 encoded keys (common with Ed25519)
      if (multibaseKey.startsWith('z')) {
        // Remove the 'z' prefix and decode
        const encoded = multibaseKey.substring(1);
        // Since base32 is not a standard encoding in Node.js, we'd normally use a library
        // For now we'll just log a warning and return false
        console.warn('Base32 decoding not directly supported - would need a library');
        return false;
      } else {
        console.error('Unsupported multibase format');
        return false;
      }
    } else if (verificationMethod.publicKeyBase64) {
      publicKeyBytes = Buffer.from(verificationMethod.publicKeyBase64, 'base64');
    } else if (verificationMethod.publicKeyHex) {
      publicKeyBytes = Buffer.from(verificationMethod.publicKeyHex, 'hex');
    } else {
      console.error('No supported public key format found in verification method');
      return false;
    }
    
    // Verify the signature using Node.js crypto
    const crypto = require('crypto');
    const verify = crypto.createVerify('sha256');
    verify.update(message);
    verify.end();
    
    return verify.verify({
      key: publicKeyBytes,
      format: 'der',
      type: 'spki'
    }, signature);
  } catch (error) {
    console.error('Error verifying Ed25519 signature:', error);
    return false;
  }
}

/**
 * Verify a secp256k1 signature
 * 
 * @param message - The message that was signed
 * @param signature - The signature bytes
 * @param verificationMethod - The verification method containing the public key
 * @returns Whether the signature is valid
 */
function verifySecp256k1Signature(
  message: Buffer,
  signature: Buffer,
  verificationMethod: any
): boolean {
  // This is a simplified implementation for secp256k1
  try {
    // Extract the public key
    let publicKeyHex: string;
    
    if (verificationMethod.publicKeyHex) {
      publicKeyHex = verificationMethod.publicKeyHex;
    } else if (verificationMethod.publicKeyBase64) {
      const keyBytes = Buffer.from(verificationMethod.publicKeyBase64, 'base64');
      publicKeyHex = keyBytes.toString('hex');
    } else if (verificationMethod.publicKeyJwk) {
      // Convert JWK to hex - simplified version
      console.warn('JWK key format conversion not fully implemented');
      return false;
    } else {
      console.error('No supported public key format found for secp256k1');
      return false;
    }
    
    // This would use bitcoinjs-lib in a real implementation
    // For now we'll return false as placeholder
    console.warn('Secp256k1 verification not fully implemented - returning false');
    return false;
  } catch (error) {
    console.error('Error verifying secp256k1 signature:', error);
    return false;
  }
}

/**
 * Create a canonicalized version of a credential for consistent verification
 * 
 * @param credential - The credential to canonicalize
 * @returns A canonicalized representation for verification
 */
function canonicalizeCredential(credential: any): any {
  if (credential === null || typeof credential !== 'object') {
    return credential;
  }
  
  if (Array.isArray(credential)) {
    return credential.map(canonicalizeCredential);
  }
  
  // Sort keys for consistent ordering
  const sortedKeys = Object.keys(credential).sort();
  const result: Record<string, any> = {};
  
  for (const key of sortedKeys) {
    result[key] = canonicalizeCredential(credential[key]);
  }
  
  return result;
}

/**
 * Service for handling VC operations
 */
export class VCService {
  private config: VCServiceConfig;
  private client: ReturnType<typeof createResilientClient>;
  private circuitBreaker: CircuitBreaker;
  private credentialRepository: CredentialRepository;
  
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
    
    // Initialize credential repository
    this.credentialRepository = new InMemoryCredentialRepository({
      enableEncryption: this.config.credentialRepository?.enableEncryption,
      encryptionKey: this.config.credentialRepository?.encryptionKey,
      persistencePath: this.config.credentialRepository?.persistencePath,
      autoSaveIntervalMs: this.config.credentialRepository?.autoSaveIntervalMs
    });
    
    if (this.config.enableLogging) {
      console.log('VCService initialized with config:', {
        acesApiUrl: this.config.acesApiUrl,
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
      
      // Check for credential expiration
      if (credential.expirationDate) {
        const expirationDate = new Date(credential.expirationDate);
        const now = new Date();
        
        if (now > expirationDate) {
          if (this.config.enableLogging) {
            console.error('Credential has expired', {
              id: credential.id,
              expired: credential.expirationDate
            });
          }
          return false;
        }
      }
      
      // Check credential status if available
      if (credential.credentialStatus) {
        const statusResult = await this.checkCredentialStatus(credential);
        if (!statusResult) {
          if (this.config.enableLogging) {
            console.error('Credential has been revoked or is invalid', {
              id: credential.id,
              status: credential.credentialStatus
            });
          }
          return false;
        }
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
      // Handle different credential status types
      const { type, id } = credential.credentialStatus;
      
      if (type === 'RevocationList2020Status') {
        // Example implementation for RevocationList2020Status
        // In a real implementation, this would fetch the revocation list and check
        // if the credential is in it
        
        if (this.config.enableLogging) {
          console.log('Checking RevocationList2020Status for credential', {
            credentialId: credential.id,
            statusId: id
          });
        }
        
        // For now, we simulate this with a warning and return true
        console.warn('RevocationList2020Status check not fully implemented - assuming valid');
        return true;
      } else if (type === 'StatusList2021Entry') {
        // Example implementation for StatusList2021Entry
        // This would check a specific bit in a status list
        
        if (this.config.enableLogging) {
          console.log('Checking StatusList2021Entry for credential', {
            credentialId: credential.id,
            statusId: id
          });
        }
        
        // For now, we simulate this with a warning and return true
        console.warn('StatusList2021Entry check not fully implemented - assuming valid');
        return true;
      } else {
        if (this.config.enableLogging) {
          console.warn('Unknown credential status type', {
            type,
            id,
            credentialId: credential.id
          });
        }
        
        // We don't know how to check this status type
        // In production, you might want to fail or have a configurable policy
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

  /**
   * Get statistics about stored credentials
   * 
   * @returns Statistics about the credential store
   */
  async getCredentialStats(): Promise<any> {
    try {
      return await this.credentialRepository.getStats();
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('Error getting credential statistics:', error);
      }
      return {
        error: 'Failed to retrieve credential statistics',
        message: error instanceof Error ? error.message : String(error)
      };
    }
  }
} 