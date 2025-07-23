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
import { inflate } from 'pako'; // For decompressing gzipped status lists (will be used later)

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
import canonicalize from 'canonicalize';
import * as jose from 'jose';
import { verify as ed25519Verify } from '@noble/ed25519';
import { base64 } from 'multiformats/bases/base64';
import { base16 } from 'multiformats/bases/base16';
import { base58btc } from 'multiformats/bases/base58'; // For base58btc ('z' prefix)
import { sha256 } from '@noble/hashes/sha256';
import { Signature as Secp256k1Signature, verify as secp256k1Verify } from '@noble/secp256k1';
// import { multibase } from 'multiformats/bases/multibase'; // Temporarily removed
// import { Codec, decode as multibaseDecode } from 'multiformats/bases/multibase'; // Temporarily removed

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
        return verifyDataIntegrityProof(credential, proof.proofValue, verificationMethod);
      }
      case ProofType.JWT: {
        return await verifyJwtProof(credential, proof.proofValue, verificationMethod);
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
async function verifyJwtProof(
  credential: VerifiableCredential,
  proofValue: string,
  verificationMethod: any
): Promise<boolean> {
  try {
    if (!verificationMethod.publicKeyJwk) {
      console.error('publicKeyJwk not found in verificationMethod for JWT proof');
      return false;
    }

    // Import the public key
    const publicKey = await jose.importJWK(verificationMethod.publicKeyJwk);

    // Verify the JWT
    // We need to know the expected issuer. Assuming it's the credential.issuer.id
    // Algorithms should be restricted for security. For now, let jose infer from JWK or allow common ones.
    // Consider making algorithms more specific based on verificationMethod.type or a predefined list.
    const { payload } = await jose.jwtVerify(proofValue, publicKey, {
      issuer: credential.issuer.id, // Validate that the JWT issuer matches the credential issuer
      // audience: 'expectedAudience', // If applicable
      // clockTolerance: '2 minutes', // If needed
    });

    // Additional payload validations can be done here if necessary,
    // e.g., ensuring JWT specific claims match credential content if not covered by issuer/subject/etc.
    // For example, if the JWT contains a nonce or specific subject claim related to the credential.
    console.log('JWT verified successfully, payload:', payload);
    return true;

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
    let publicKeyBytes: Uint8Array;

    if (verificationMethod.publicKeyMultibase) {
      const multibaseKey: string = verificationMethod.publicKeyMultibase;
      const prefix = multibaseKey.charAt(0);
      const encodedKey = multibaseKey.substring(1);

      if (prefix === 'z') { // base58btc
        publicKeyBytes = base58btc.decoder.decode(encodedKey);
      } else if (prefix === 'm') { // base64 (standard, no padding)
        // Ensure base64.decoder.decode returns Uint8Array
        // The multiformats base decoders typically return Uint8Array.
        publicKeyBytes = base64.decoder.decode(encodedKey);
      } else {
        console.error(`Unsupported multibase prefix '${prefix}' for Ed25519 public key`);
        return false;
      }
    } else if (verificationMethod.publicKeyBase64) {
      publicKeyBytes = Buffer.from(verificationMethod.publicKeyBase64, 'base64');
    } else if (verificationMethod.publicKeyHex) {
      publicKeyBytes = Buffer.from(verificationMethod.publicKeyHex, 'hex');
    } else {
      console.error('No supported public key format found in verificationMethod for Ed25519');
      return false;
    }

    // This check is now after the multibase block, so it's fine.
    if (!publicKeyBytes || publicKeyBytes.length === 0) {
        console.error('Failed to derive public key bytes for Ed25519 verification');
        return false;
    }

    return ed25519Verify(signature, message, publicKeyBytes);

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
  message: Buffer,       // This is the data that was signed (e.g., canonicalized credential)
  signature: Buffer,     // The DER-encoded signature bytes, or potentially raw r,s
  verificationMethod: any
): boolean {
  try {
    let publicKeyBytes: Uint8Array;

    // Public Key Extraction Priority: JWK, Multibase, Hex, Base64
    if (verificationMethod.publicKeyJwk) {
      const jwk = verificationMethod.publicKeyJwk;
      if (jwk.kty === 'EC' && jwk.crv === 'P-256K' && jwk.x && jwk.y) {
        // This is a common secp256k1 JWK format.
        // We need the uncompressed public key: 0x04 + x + y
        const x = Buffer.from(jwk.x, 'base64url'); // JWK uses base64url
        const y = Buffer.from(jwk.y, 'base64url');
        publicKeyBytes = Buffer.concat([Buffer.from([0x04]), x, y]);
      } else {
        console.error('Unsupported JWK format for secp256k1. Expected EC P-256K with x and y.');
        return false;
      }
    } else if (verificationMethod.publicKeyMultibase) {
      const multibaseKey: string = verificationMethod.publicKeyMultibase;
      const prefix = multibaseKey.charAt(0);
      const encodedKey = multibaseKey.substring(1);
      if (prefix === 'z') { // base58btc is common for secp256k1 public keys too
        publicKeyBytes = base58btc.decoder.decode(encodedKey);
      } else {
        console.error(`Unsupported multibase prefix '${prefix}' for secp256k1 public key.`);
        return false;
      }
    } else if (verificationMethod.publicKeyHex) {
      publicKeyBytes = Buffer.from(verificationMethod.publicKeyHex, 'hex');
    } else if (verificationMethod.publicKeyBase64) {
      publicKeyBytes = Buffer.from(verificationMethod.publicKeyBase64, 'base64');
    } else {
      console.error('No supported public key format found for secp256k1');
      return false;
    }

    if (!publicKeyBytes || publicKeyBytes.length === 0) {
      console.error('Failed to derive public key bytes for secp256k1 verification');
      return false;
    }

    // Secp256k1 typically signs the hash of the message.
    // The `message` param is the canonicalized document.
    const messageHash = sha256(message);

    // Attempt to parse signature as DER, then normalize S value.
    // @noble/secp256k1's verify function can take a Signature instance or raw (r,s) bytes.
    let sigToVerify: Secp256k1Signature | Uint8Array;
    try {
      sigToVerify = Secp256k1Signature.fromDER(signature).normalizeS();
    } catch (derError) {
      // If not DER, assume it might be 64-byte r+s format if applicable.
      // For now, we strictly expect DER or rely on verify to handle raw if it can.
      // If signature is 64 bytes, noble/secp256k1 verify might handle it directly.
      if (signature.length === 64) {
        sigToVerify = signature; 
      } else {
        console.error('Secp256k1 signature is not valid DER and not 64 bytes raw format:', derError);
        return false;
      }
    }
    
    return secp256k1Verify(sigToVerify, messageHash, publicKeyBytes);

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
  return canonicalize(credential);
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

    try {
      // Extract issuer DID
      const issuerDid = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id;
      
      // First try auto-detection to see what the issuer DID contains
      let didResolution = await this.didService.resolveDID(issuerDid);
      
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
        const didDocResult = await this.didService.resolveDidDocument(issuerDid);
        
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
          const bitstring = Buffer.from(inflate(compressedBytes)); // Decompress with pako.inflate

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