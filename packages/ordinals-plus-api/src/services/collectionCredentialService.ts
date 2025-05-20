/**
 * Collection Credential Service
 * 
 * This service handles the issuance and management of verifiable credentials
 * for curated collections of inscriptions.
 */
import { v4 as uuidv4 } from 'uuid';
import { 
  ProofType,
  VC_CONTEXTS,
  VC_TYPES
} from '../types/verifiableCredential';
import type { 
  VerifiableCredential, 
  CredentialContext, 
  CredentialProof, 
  CredentialType
} from '../types/verifiableCredential';
import type { 
  Collection, 
  CollectionCredential, 
  CollectionCredentialSubject,
  CollectionCredentialIssuanceParams
} from '../types/collection';
import type { CredentialRepository } from '../repositories/credentialRepository';
import type { CollectionRepository } from '../repositories/collectionRepository';
import { ApiService } from './apiService';
import { logger } from '../utils/logger';

/**
 * Configuration for the collection credential service
 */
export interface CollectionCredentialServiceConfig {
  /** Whether to enable debug logging */
  enableDebugLogging?: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: CollectionCredentialServiceConfig = {
  enableDebugLogging: false
};

/**
 * Service for issuing and managing collection credentials
 */
export class CollectionCredentialService {
  private config: CollectionCredentialServiceConfig;

  /**
   * Create a new collection credential service
   * 
   * @param credentialRepository - Repository for storing credentials
   * @param collectionRepository - Repository for storing collections
   * @param apiService - API service for external operations
   * @param config - Configuration options
   */
  constructor(
    private credentialRepository: CredentialRepository,
    private collectionRepository: CollectionRepository,
    private apiService: ApiService,
    config: Partial<CollectionCredentialServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logDebug('CollectionCredentialService initialized');
  }

  /**
   * Issue a credential for a collection
   * 
   * @param params - Parameters for issuing the collection credential
   * @returns The issued credential and its ID
   */
  async issueCollectionCredential(params: CollectionCredentialIssuanceParams): Promise<{
    credential: CollectionCredential;
    credentialId: string;
  }> {
    const { collectionId, issuerDid } = params;
    this.logDebug(`Issuing collection credential for collection ${collectionId} by issuer ${issuerDid}`);

    // Get the collection
    const collection = await this.collectionRepository.getCollectionById(collectionId);
    if (!collection) {
      throw new Error(`Collection not found: ${collectionId}`);
    }

    // Verify that the issuer is the curator of the collection
    if (collection.curatorDid !== issuerDid) {
      throw new Error('Only the curator can issue a credential for this collection');
    }

    // Create the credential
    const credential = await this.createCollectionCredential(collection, issuerDid);

    // Sign the credential
    const signedCredential = await this.signCredential(credential, issuerDid);

    // Store the credential
    const credentialId = await this.credentialRepository.storeCredential(signedCredential, {
      collectionId
    });

    // Update the collection with the credential ID
    await this.collectionRepository.setCollectionCredential(collectionId, credentialId);

    return {
      credential: signedCredential as CollectionCredential,
      credentialId
    };
  }

  /**
   * Create a collection credential without signing it
   * 
   * @param collection - The collection to create a credential for
   * @param issuerDid - The DID of the issuer
   * @returns The unsigned credential
   */
  private async createCollectionCredential(collection: Collection, issuerDid: string): Promise<CollectionCredential> {
    // Create the credential subject
    const credentialSubject: CollectionCredentialSubject = {
      id: `did:collection:${collection.id}`,
      type: 'Collection',
      collection: collection.metadata,
      items: collection.items
    };

    // Create the credential
    const credential: CollectionCredential = {
      '@context': [
        VC_CONTEXTS.CORE_V2,
        VC_CONTEXTS.ORDINALS_PLUS,
        'https://ordinals.plus/contexts/collection/v1'
      ],
      id: `urn:uuid:${uuidv4()}`,
      type: [
        VC_TYPES.VERIFIABLE_CREDENTIAL,
        'CollectionCredential'
      ],
      issuer: {
        id: issuerDid
      },
      issuanceDate: new Date().toISOString(),
      credentialSubject
    };

    return credential;
  }

  /**
   * Sign a credential
   * 
   * @param credential - The credential to sign
   * @param issuerDid - The DID of the issuer
   * @returns The signed credential
   */
  private async signCredential(credential: VerifiableCredential, issuerDid: string): Promise<VerifiableCredential> {
    try {
      // Call the API to sign the credential
      const response = await this.apiService.post('/verifiable-credentials/sign', {
        credential,
        issuerDid
      });

      // Return the signed credential
      return response.data.credential;
    } catch (error) {
      this.logDebug(`Error signing credential: ${error}`);
      throw new Error(`Failed to sign credential: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get a collection credential by ID
   * 
   * @param credentialId - The ID of the credential
   * @returns The credential if found, null otherwise
   */
  async getCollectionCredential(credentialId: string): Promise<CollectionCredential | null> {
    const result = await this.credentialRepository.getCredentialById(credentialId);
    if (!result) {
      return null;
    }

    // Verify that it's a collection credential
    const credential = result.credential as VerifiableCredential;
    if (!this.isCollectionCredential(credential)) {
      return null;
    }

    return credential as CollectionCredential;
  }

  /**
   * Find collection credentials by curator DID
   * 
   * @param curatorDid - The DID of the curator
   * @returns Array of collection credentials
   */
  async findCollectionCredentialsByCurator(curatorDid: string): Promise<CollectionCredential[]> {
    // Find collections by curator
    const collectionsResult = await this.collectionRepository.findCollectionsByCurator(curatorDid);
    
    // Get credentials for each collection
    const credentials: CollectionCredential[] = [];
    for (const collection of collectionsResult.collections) {
      if (collection.credential) {
        credentials.push(collection.credential as CollectionCredential);
      }
    }

    return credentials;
  }

  /**
   * Revoke a collection credential
   * 
   * @param credentialId - The ID of the credential to revoke
   * @param issuerDid - The DID of the issuer
   * @returns Whether the revocation was successful
   */
  async revokeCollectionCredential(credentialId: string, issuerDid: string): Promise<boolean> {
    // Get the credential
    const result = await this.credentialRepository.getCredentialById(credentialId);
    if (!result) {
      throw new Error(`Credential not found: ${credentialId}`);
    }

    const credential = result.credential as VerifiableCredential;
    const issuer = typeof credential.issuer === 'string' ? credential.issuer : credential.issuer.id;

    // Verify that the issuer is the one who issued the credential
    if (issuer !== issuerDid) {
      throw new Error('Only the issuer can revoke this credential');
    }

    // Call the API to revoke the credential
    try {
      await this.apiService.post('/verifiable-credentials/revoke', {
        credentialId,
        issuerDid
      });

      // Update the credential status in the repository
      await this.credentialRepository.updateCredential(credentialId, credential, {
        ...result.metadata,
        revoked: true,
        revokedAt: new Date().toISOString()
      });

      // Find collections using this credential and update them
      if (result.metadata.collectionId) {
        const collection = await this.collectionRepository.getCollectionById(result.metadata.collectionId);
        if (collection) {
          // Remove the credential reference from the collection
          await this.collectionRepository.setCollectionCredential(collection.id, '');
        }
      }

      return true;
    } catch (error) {
      this.logDebug(`Error revoking credential: ${error}`);
      throw new Error(`Failed to revoke credential: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if a credential is a collection credential
   * 
   * @param credential - The credential to check
   * @returns Whether the credential is a collection credential
   */
  private isCollectionCredential(credential: VerifiableCredential): boolean {
    // Check if the credential has the CollectionCredential type
    if (Array.isArray(credential.type)) {
      return credential.type.includes('CollectionCredential');
    } else {
      return credential.type === 'CollectionCredential';
    }
  }

  /**
   * Log a debug message if debug logging is enabled
   * 
   * @param message - The message to log
   */
  private logDebug(message: string): void {
    if (this.config.enableDebugLogging) {
      logger.debug(`[CollectionCredentialService] ${message}`);
    }
  }
}

export default CollectionCredentialService;
