import type { 
  ExplorerApiResponse as ApiResponse, 
  DID, 
  LinkedResource,
  Inscription
} from '../types';
import { 
  createDidFromInscription, 
  createLinkedResourceFromInscription, 
} from 'ordinalsplus';
import { 
  fetchInscriptions, 
  fetchInscriptionById, 
  fetchInscriptionContent 
} from '../services/ordinalsService';

// Simple cache to avoid refetching on every request
const resourcesCache: Record<string, ApiResponse> = {};
const cacheTimestamps: Record<string, number> = {};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Get all resources with pagination
 */
export const getAllResources = async (page = 1, limit = 10): Promise<ApiResponse> => {
  try {
    // Check if API key is set
    if (!process.env.ORDISCAN_API_KEY) {
      console.error('ORDISCAN_API_KEY is not set in environment variables.');
      return {
        dids: [],
        linkedResources: [],
        page: page,
        totalItems: 0,
        itemsPerPage: limit,
        error: 'API key not configured. Please set the ORDISCAN_API_KEY environment variable.'
      };
    }
    
    const cacheKey = `resources_${page}_${limit}`;
    
    // Check if we have cached data
    if (resourcesCache[cacheKey]) {
      const cacheAge = Date.now() - (cacheTimestamps[cacheKey] || 0);
      if (cacheAge < CACHE_EXPIRATION) {
        return resourcesCache[cacheKey];
      }
    }
    
    // Calculate offset based on page
    const offset = (page - 1) * limit;
    
    // Fetch inscriptions from the ordinals service
    const inscriptionsResponse = await fetchInscriptions(offset, limit);
    const inscriptions = inscriptionsResponse.results;
    
    // Create a map to store DID references for resources
    const didReferences = new Map<string, string>();
    
    // Process inscriptions to extract DIDs
    const dids: DID[] = [];
    for (const inscription of inscriptions) {
      // Check if this is a DID inscription
      if (
        inscription.content && 
        typeof inscription.content === 'object' &&
        inscription.content !== null
      ) {
        const content = inscription.content as Record<string, unknown>;
        if (
          content.id && 
          typeof content.id === 'string' &&
          isValidBtcoDid(content.id)
        ) {
          // Create a DID object using the ordinalsplus package
          const did = createDidFromInscription(inscription);
          dids.push(did);
          
          // Store the DID-to-inscription mapping for resource linking
          didReferences.set(inscription.id, did.id);
        }
      }
    }
    
    // Process inscriptions to create linked resources
    const linkedResources: LinkedResource[] = [];
    for (const inscription of inscriptions) {
      // Get the content type for resource categorization
      const contentType = inscription.content_type || 'application/json';
      const resourceType = getResourceTypeFromContentType(contentType);
      
      // For certain content types, we might need to fetch the content if it's not already included
      if (!inscription.content && contentType.includes('json')) {
        try {
          // Fetch content for JSON content types
          const content = await fetchInscriptionContent(inscription.id, contentType);
          if (content) {
            inscription.content = content;
          }
        } catch (error) {
          console.warn(`Failed to fetch content for inscription ${inscription.id}`, error);
        }
      }
      
      // Find the DID reference if available
      const didReference = didReferences.get(inscription.id);
      
      // Create a linked resource using the ordinalsplus package
      const resource = createLinkedResourceFromInscription(
        inscription, 
        resourceType, 
        didReference
      );
      
      linkedResources.push(resource);
    }
    
    // Create the response object
    const response: ApiResponse = {
      dids: dids,
      linkedResources: linkedResources,
      page: page,
      totalItems: inscriptionsResponse.total,
      itemsPerPage: limit,
      error: ''
    };
    
    // Cache the response
    resourcesCache[cacheKey] = response;
    cacheTimestamps[cacheKey] = Date.now();
    
    return response;
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
    // Validate if this is a proper DID
    const isDid = isValidBtcoDid(id);
    
    // Extract the inscription ID from the DID if needed
    const inscriptionId = isDid ? id.replace('did:btco:', '') : id;
    
    // Fetch the inscription
    const inscription = await fetchInscriptionById(inscriptionId);
    
    if (!inscription) {
      return {
        dids: [],
        linkedResources: [],
        page: 0,
        totalItems: 0,
        itemsPerPage: 1,
        error: `Resource not found with ID: ${id}`
      };
    }
    
    // For certain content types, we might need to fetch the content if it's not already included
    const contentType = inscription.content_type || 'application/json';
    if (!inscription.content && contentType.includes('json')) {
      try {
        // Fetch content for JSON content types
        const content = await fetchInscriptionContent(inscription.id, contentType);
        if (content) {
          inscription.content = content;
        }
      } catch (error) {
        console.warn(`Failed to fetch content for inscription ${inscription.id}`, error);
      }
    }
    
    // Create a DID object using the ordinalsplus package
    const did = createDidFromInscription(inscription);
    
    // Determine the resource type from content type
    const resourceType = getResourceTypeFromContentType(contentType);
    
    // Create a linked resource using the ordinalsplus package
    const resource = createLinkedResourceFromInscription(
      inscription,
      resourceType,
      did.id // Reference the DID for this resource
    );
    
    return {
      dids: [did],
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
    // Ensure the DID id is properly formatted
    if (!didId || !isValidBtcoDid(didId)) {
      return {
        dids: [],
        linkedResources: [],
        page: 0,
        totalItems: 0,
        itemsPerPage: 0,
        error: 'Invalid DID identifier'
      };
    }

    // Fetch all inscriptions for this DID
    const inscriptions = await fetchInscriptionsByDid(didId);
    
    if (!inscriptions || inscriptions.length === 0) {
      return {
        dids: [],
        linkedResources: [],
        page: 0,
        totalItems: 0,
        itemsPerPage: 0,
        error: `No resources found for DID: ${didId}`
      };
    }

    // Create a DID object using the ordinalsplus package
    const did = createDid(didId);
    
    // Map inscriptions to linked resources
    const linkedResources = await Promise.all(inscriptions.map(async (inscription) => {
      // For certain content types, we might need to fetch the content if it's not already included
      const contentType = inscription.content_type || 'application/json';
      if (!inscription.content && contentType.includes('json')) {
        try {
          // Fetch content for JSON content types
          const content = await fetchInscriptionContent(inscription.id, contentType);
          if (content) {
            inscription.content = content;
          }
        } catch (error) {
          console.warn(`Failed to fetch content for inscription ${inscription.id}`, error);
        }
      }
      
      // Determine the resource type from content type
      const resourceType = getResourceTypeFromContentType(contentType);
      
      // Create a linked resource using the ordinalsplus package
      return createLinkedResourceFromInscription(
        inscription,
        resourceType,
        didId
      );
    }));

    // Create the response
    const response: ApiResponse = {
      dids: [did],
      linkedResources,
      page: 0,
      totalItems: inscriptions.length,
      itemsPerPage: linkedResources.length,
      error: ''
    };
    
    return response;
  } catch (error) {
    console.error(`Error fetching resources by DID ${didId}:`, error);
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