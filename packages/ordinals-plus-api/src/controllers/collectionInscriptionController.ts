/**
 * Collection Inscription Controller
 * 
 * This controller handles HTTP requests related to collection inscriptions.
 */
import { CollectionInscriptionService } from '../services/collectionInscriptionService';
import type { CollectionInscriptionRequest } from '../types/collectionInscription';

/**
 * Controller for collection inscription operations
 */
export class CollectionInscriptionController {
  /**
   * Create a new collection inscription controller
   * 
   * @param collectionInscriptionService - Service for handling collection inscriptions
   */
  constructor(private collectionInscriptionService: CollectionInscriptionService) {}

  /**
   * Start the inscription process for a collection
   * 
   * @param params - Collection inscription request parameters
   * @returns The created inscription record
   */
  async startInscription(params: CollectionInscriptionRequest) {
    try {
      const result = await this.collectionInscriptionService.startInscription(params);
      
      return {
        status: 'success',
        message: 'Collection inscription process started',
        data: {
          inscriptionId: result.id,
          status: result.status,
          collectionId: result.collectionId
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to start collection inscription: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get the status of a collection inscription
   * 
   * @param inscriptionId - The ID of the inscription
   * @returns The inscription status
   */
  async getInscriptionStatus(inscriptionId: string) {
    try {
      const inscription = await this.collectionInscriptionService.getInscription(inscriptionId);
      
      if (!inscription) {
        return {
          status: 'error',
          message: `Collection inscription not found: ${inscriptionId}`
        };
      }
      
      return {
        status: 'success',
        data: {
          inscription
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to get inscription status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Get inscriptions for a collection
   * 
   * @param collectionId - The ID of the collection
   * @returns Array of inscriptions for the collection
   */
  async getInscriptionsForCollection(collectionId: string) {
    try {
      const inscriptions = await this.collectionInscriptionService.getInscriptionsForCollection(collectionId);
      
      return {
        status: 'success',
        data: {
          inscriptions,
          count: inscriptions.length
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to get collection inscriptions: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Cancel an in-progress inscription
   * 
   * @param inscriptionId - The ID of the inscription to cancel
   * @param requesterDid - The DID of the user requesting cancellation
   * @returns The updated inscription
   */
  async cancelInscription(inscriptionId: string, requesterDid: string) {
    try {
      // Get the inscription to check authorization
      const inscription = await this.collectionInscriptionService.getInscription(inscriptionId);
      
      if (!inscription) {
        return {
          status: 'error',
          message: `Collection inscription not found: ${inscriptionId}`
        };
      }
      
      // Check if the requester is authorized
      if (inscription.requesterDid !== requesterDid) {
        return {
          status: 'error',
          message: 'Only the original requester can cancel this inscription'
        };
      }
      
      const result = await this.collectionInscriptionService.cancelInscription(inscriptionId);
      
      return {
        status: 'success',
        message: 'Collection inscription cancelled successfully',
        data: {
          inscription: result
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to cancel inscription: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Verify an on-chain collection inscription
   * 
   * @param inscriptionId - The inscription ID to verify
   * @param collectionId - The collection ID to verify against
   * @returns Verification result
   */
  async verifyInscription(inscriptionId: string, collectionId: string) {
    try {
      const isValid = await this.collectionInscriptionService.verifyCollectionInscription(
        inscriptionId,
        collectionId
      );
      
      return {
        status: 'success',
        data: {
          isValid,
          inscriptionId,
          collectionId,
          verifiedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to verify inscription: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

export default CollectionInscriptionController;
