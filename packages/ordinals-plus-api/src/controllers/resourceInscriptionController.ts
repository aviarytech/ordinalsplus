/**
 * Resource Inscription Controller
 * 
 * Handles operations for resource inscription
 */
import type { ResourceInscriptionRequest } from '../services/resourceInscriptionService';
import { ResourceInscriptionService } from '../services/resourceInscriptionService';
import { logger } from '../utils/logger';
import { ApiService } from '../services/apiService';

// In-memory repository to simulate persistence for demo/testing
type InscriptionRecord = any;
const inscriptionStore = new Map<string, InscriptionRecord>();
let inscriptionIdCounter = 0;

const mockResourceInscriptionRepository = {
  createInscription: async (inscription: any) => {
    const id = String(++inscriptionIdCounter);
    const record = { id, ...inscription };
    inscriptionStore.set(id, record);
    return record;
  },
  getInscriptionById: async (id: string) => {
    return inscriptionStore.get(id) || null;
  },
  getInscriptionsByParentDid: async (parentDid: string) => {
    const result: any[] = [];
    for (const rec of inscriptionStore.values()) {
      if (rec.parentDid === parentDid) result.push(rec);
    }
    return result;
  },
  updateInscription: async (id: string, update: any) => {
    const existing = inscriptionStore.get(id) || { id };
    const updated = { ...existing, ...update };
    inscriptionStore.set(id, updated);
    return updated;
  }
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
 * Start a batch of resource inscriptions
 *
 * @param requests - Array of resource inscription requests
 * @returns Array of created resource inscription records or error
 */
export const startBatchResourceInscription = async (requests: ResourceInscriptionRequest[]) => {
  try {
    logger.debug('Starting batch resource inscription', { count: requests.length });

    const results = [] as any[];
    for (const req of requests) {
      const ins = await resourceInscriptionService.startInscription(req);
      results.push(ins);
    }

    return results;
  } catch (error) {
    logger.error('Error starting batch resource inscription', error);
    throw error;
  }
};

/**
 * Prepare a resource inscription for funding (commit stage)
 */
export const prepareResourceInscription = async (
  id: string,
  network: 'mainnet' | 'signet' | 'testnet',
  recipientAddress: string,
  feeRate?: number
) => {
  try {
    return await resourceInscriptionService.prepare(id, { network, recipientAddress, feeRate });
  } catch (error) {
    logger.error('Error preparing resource inscription', error);
    throw error;
  }
};

/**
 * Accept commit transaction ID (after user funds and broadcasts commit)
 */
export const acceptCommitTx = async (id: string, commitTxid: string) => {
  try {
    return await resourceInscriptionService.acceptCommit(id, commitTxid);
  } catch (error) {
    logger.error('Error accepting commit tx', error);
    throw error;
  }
};

/**
 * Finalize reveal (after creating and broadcasting reveal)
 */
export const finalizeRevealTx = async (id: string, revealTxid: string) => {
  try {
    return await resourceInscriptionService.finalizeReveal(id, revealTxid);
  } catch (error) {
    logger.error('Error finalizing reveal tx', error);
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
