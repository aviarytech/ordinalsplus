import type { 
  ExplorerApiResponse as ApiResponse, 
  DID, 
  LinkedResource,
  Inscription
} from '../types';
import { 
  fetchInscriptions, 
  fetchInscriptionById, 
  fetchInscriptionContent, 
  fetchInscriptionBySat
} from '../services/ordinalsService';
import { getProvider } from '../services/providerService';

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Simple cache to avoid refetching on every request
const resourcesCache: Record<string, ApiResponse> = {};
const cacheTimestamps: Record<string, number> = {};

/**
 * Get all resources with pagination
 */
export const getAllResources = async (page = 1, limit = 20, contentType?: string | null): Promise<ApiResponse> => {
  try {
    const provider = getProvider();
    const generator = provider.getAllResources({ 
      batchSize: limit,
      startFrom: (page - 1) * limit // Calculate the starting cursor based on page
    });

    let resources: LinkedResource[] = [];
    let totalItems = 0;

    // Get the first batch of resources
    const result = await generator.next();
    if (!result.done && result.value) {
      resources = result.value;
      // Get the next batch to check if there are more items
      const nextResult = await generator.next();
      totalItems = resources.length + (nextResult.done ? 0 : nextResult.value.length);
    }

    // Filter by content type if specified
    if (contentType) {
      resources = resources.filter((resource: LinkedResource) => 
        resource.contentType?.includes(contentType)
      );
      // Adjust total items based on filtered count
      totalItems = resources.length;
    }

    console.log(`Fetched page ${page} with ${resources.length} resources, total items: ${totalItems}`);

    return {
      dids: [], // DIDs are now handled separately
      linkedResources: resources,
      page: page,
      totalItems: totalItems,
      itemsPerPage: limit,
      error: ''
    };
  } catch (error) {
    console.error('Error fetching resources:', error);
    return {
      dids: [],
      linkedResources: [],
      page: page,
      totalItems: 0,
      itemsPerPage: limit,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get a single resource by its DID or inscription ID
 */
export const getResourceById = async (id: string): Promise<ApiResponse> => {
  try {
    const provider = getProvider();
    const resource = await provider.resolve(id);

    return {
      dids: [], // DIDs are now handled separately
      linkedResources: [resource],
      page: 0,
      totalItems: 1,
      itemsPerPage: 1,
      error: ''
    };
  } catch (error) {
    console.error(`Error fetching resource by ID ${id}:`, error);
    return {
      dids: [],
      linkedResources: [],
      page: 0,
      totalItems: 0,
      itemsPerPage: 1,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Get resources associated with a specific DID
 */
export const getResourcesByDid = async (didId: string): Promise<ApiResponse> => {
  try {
    const provider = getProvider();
    const resources = await provider.resolveCollection(didId, {});

    return {
      dids: [], // DIDs are now handled separately
      linkedResources: resources,
      page: 0,
      totalItems: resources.length,
      itemsPerPage: resources.length,
      error: ''
    };
  } catch (error) {
    console.error(`Error fetching resources for DID ${didId}:`, error);
    return {
      dids: [],
      linkedResources: [],
      page: 0,
      totalItems: 0,
      itemsPerPage: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Helper function to determine resource type from content type
 */
const getResourceTypeFromContentType = (contentType: string): string => {
  if (contentType.includes('image')) {
    return 'Image';
  } else if (contentType.includes('text')) {
    return 'Text';
  } else if (contentType.includes('json')) {
    return 'JSON';
  } else if (contentType.includes('video')) {
    return 'Video';
  } else if (contentType.includes('audio')) {
    return 'Audio';
  }
  
  // Default resource type
  return 'Resource';
}

/**
 * Helper function to create a DID object
 */
const createDid = (didId: string): DID => {
  // Extract inscription ID from DID
  // DID format: did:btco:<inscriptionId>
  const parts = didId.split(':');
  // Ensure inscriptionId is always a string, never undefined
  const inscriptionId = parts.length === 3 && parts[2] ? parts[2] : '';
  
  return {
    id: didId,
    inscriptionId,
    contentType: 'application/json',
    content: {}
  };
}

/**
 * Helper function to check if a string is a valid BTCO DID
 */
const isValidBtcoDid = (didString: string | undefined | null): boolean => {
  return Boolean(didString && didString.startsWith('did:btco:'));
}

// Create a function to fetch inscriptions by DID
const fetchInscriptionsByDid = async (didId: string | undefined | null): Promise<Inscription[]> => {
  if (!didId) {
    return [];
  }
  
  try {
    // Extract inscription ID from DID
    // DID format: did:btco:<inscriptionId>
    const parts = didId.split(':');
    if (parts.length !== 3) {
      return [];
    }
    
    const inscriptionId = parts[2];
    if (!inscriptionId) {
      return [];
    }
    
    const inscription = await fetchInscriptionById(inscriptionId);
    
    // If we found the inscription, return it in an array
    if (inscription) {
      return [inscription];
    }
    
    return [];
  } catch (error) {
    console.error(`Error fetching inscriptions by DID ${didId}:`, error);
    return [];
  }
}; 