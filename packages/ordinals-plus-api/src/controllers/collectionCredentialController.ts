/**
 * Collection Credential Controller
 * 
 * This controller handles HTTP requests related to collection credentials.
 */
import { CollectionCredentialService } from '../services/collectionCredentialService';
import type { CollectionCredentialIssuanceParams } from '../types/collection';

/**
 * Controller for collection credential operations
 */
export class CollectionCredentialController {
  /**
   * Create a new collection credential controller
   * 
   * @param collectionCredentialService - Service for handling collection credentials
   */
  constructor(private collectionCredentialService: CollectionCredentialService) {}

  /**
   * Issue a credential for a collection
   * 
   * @param params - Collection credential issuance parameters
   * @returns The issued credential and its ID
   */
  async issueCollectionCredential(params: CollectionCredentialIssuanceParams) {
    try {
      const result = await this.collectionCredentialService.issueCollectionCredential(params);
      
      return {
        status: 'success',
        message: 'Collection credential issued successfully',
        data: {
          credentialId: result.credentialId,
          credential: result.credential
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to issue collection credential: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get a collection credential by ID
   * 
   * @param credentialId - The ID of the credential
   * @returns The credential if found
   */
  async getCollectionCredential(credentialId: string) {
    try {
      const credential = await this.collectionCredentialService.getCollectionCredential(credentialId);
      
      if (!credential) {
        return {
          status: 'error',
          message: `Collection credential not found: ${credentialId}`
        };
      }
      
      return {
        status: 'success',
        data: {
          credential
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to get collection credential: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Find collection credentials by curator DID
   * 
   * @param curatorDid - The DID of the curator
   * @returns Array of collection credentials
   */
  async findCollectionCredentialsByCurator(curatorDid: string) {
    try {
      const credentials = await this.collectionCredentialService.findCollectionCredentialsByCurator(curatorDid);
      
      return {
        status: 'success',
        data: {
          credentials,
          count: credentials.length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to find collection credentials: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Revoke a collection credential
   * 
   * @param credentialId - The ID of the credential to revoke
   * @param issuerDid - The DID of the issuer
   * @returns Whether the revocation was successful
   */
  async revokeCollectionCredential(credentialId: string, issuerDid: string) {
    try {
      const success = await this.collectionCredentialService.revokeCollectionCredential(credentialId, issuerDid);
      
      return {
        status: 'success',
        message: 'Collection credential revoked successfully',
        data: {
          revoked: success
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to revoke collection credential: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default CollectionCredentialController;
