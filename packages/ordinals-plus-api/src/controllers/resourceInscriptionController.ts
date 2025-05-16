/**
 * Resource Inscription Controller
 * 
 * Handles operations for resource inscription
 */
import type { ResourceInscriptionRequest } from '../services/resourceInscriptionService';
import { ResourceInscriptionService } from '../services/resourceInscriptionService';
import { logger } from '../utils/logger';
import { ApiService } from '../services/apiService';

// Mock repository for now - would be replaced with a real implementation
const mockResourceInscriptionRepository = {
  createInscription: async (inscription: any) => ({ id: 'mock-id', ...inscription }),
  getInscriptionById: async (id: string) => ({ id, status: 'pending' }),
  getInscriptionsByParentDid: async (parentDid: string) => [],
  updateInscription: async (id: string, update: any) => ({ id, ...update })
};

// Create service instance
const resourceInscriptionService = new ResourceInscriptionService(
  mockResourceInscriptionRepository,
  new ApiService(),
  undefined,
  { enableDebugLogging: true }
);

/**
 * Start a new resource inscription
 * 
 * @param request - Resource inscription request
 * @returns The created resource inscription or error
 */
export const startResourceInscription = async (request: ResourceInscriptionRequest) => {
  try {
    logger.debug('Starting resource inscription', { parentDid: request.parentDid });
    
    // Start inscription using the service
    const inscription = await resourceInscriptionService.startInscription(request);
    
    // Return the inscription record
    return inscription;
  } catch (error) {
    logger.error('Error starting resource inscription', error);
    throw error;
  }
};

/**
 * Get a resource inscription by ID
 * 
 * @param id - Resource inscription ID
 * @returns The resource inscription or null if not found
 */
export const getResourceInscription = async (id: string) => {
  try {
    logger.debug('Getting resource inscription', { id });
    
    // Get inscription from repository
    const inscription = await mockResourceInscriptionRepository.getInscriptionById(id);
    
    // Return the inscription record
    return inscription;
  } catch (error) {
    logger.error('Error getting resource inscription', error);
    throw error;
  }
};

/**
 * Get all resource inscriptions for a DID
 * 
 * @param did - DID to get inscriptions for
 * @returns Array of resource inscriptions
 */
export const getResourceInscriptionsByDid = async (did: string) => {
  try {
    logger.debug('Getting resource inscriptions by DID', { did });
    
    // Get inscriptions from repository
    const inscriptions = await mockResourceInscriptionRepository.getInscriptionsByParentDid(did);
    
    // Return the inscription records
    return inscriptions;
  } catch (error) {
    logger.error('Error getting resource inscriptions by DID', error);
    throw error;
  }
};
