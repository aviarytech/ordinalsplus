import type { 
  ApiResponse
  // DID,
  // Inscription
} from '../types';
import { getProvider } from '../services/providerService';
import type { LinkedResource } from 'ordinalsplus';
import { env } from '../config/envConfig';
// Import the resource creation types and functions from ordinalsplus

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Simple cache to avoid refetching on every request
const resourcesCache: Record<string, ApiResponse> = {};
const cacheTimestamps: Record<string, number> = {};

// Define options type for clarity
interface GetAllResourcesOptions {
  network: string;
  page?: number;
  limit?: number;
  contentType?: string | null;
}

/**
 * Get all resources with pagination and network support
 */
export const getAllResources = async (options: GetAllResourcesOptions): Promise<ApiResponse> => {
  // Destructure options with defaults
  const {
    network = 'mainnet', // Default to mainnet if not provided
    page = 1,
    limit = 20,
    contentType = null
  } = options;

  console.log(`[getAllResources] Requesting resources for network: ${network}, page: ${page}, limit: ${limit}, contentType: ${contentType}`);

  try {
    // Pass the network from options to getProvider
    const provider = getProvider(network); 
    if (!provider) {
      // Updated error message slightly
      throw new Error(`Resource provider not available or configured for network: ${network}`);
    }

    // Explicit check to satisfy TypeScript, although the throw above should suffice
    if (!provider) {
      throw new Error(`Provider became null unexpectedly for network: ${network}`); // Should not happen
    }

    // Assuming provider's getAllResources also needs network or is network-specific instance
    const generator = provider.getAllResources({ 
      // network: network, // Pass network if provider method needs it explicitly
      batchSize: limit,
      startFrom: (page - 1) * limit // Calculate the starting cursor based on page
    });

    let resources: LinkedResource[] = [];
    let totalItems = 0;

    // Get the first batch of resources
    const result = await generator.next();
    if (!result.done && result.value) {
      resources = result.value;
      // Simplification: Assume total items is large or unknown for now
      // Correct pagination requires the provider to return total count separately
      totalItems = resources.length > 0 ? (page * limit + 1) : 0; // Placeholder for total > current page
    } else {
      totalItems = (page - 1) * limit + (result.value?.length || 0);
    }

    // Filter by content type if specified - This should ideally happen at the provider level if possible
    if (contentType) {
      resources = resources.filter((resource: LinkedResource) => 
        resource.contentType?.includes(contentType)
      );
      // WARNING: Filtering on the API side after fetching breaks pagination counts.
      // totalItems calculation becomes inaccurate here.
      console.warn('[getAllResources] Filtering by contentType on API side - pagination totalItems may be inaccurate.');
      // We cannot accurately determine totalItems after filtering without fetching ALL items.
      // For now, we'll return the filtered list for the current page, but totalItems will be misleading.
      totalItems = resources.length > 0 ? (page * limit + 1) : (page - 1) * limit + resources.length; // Still a placeholder
    }

    console.log(`Fetched page ${page} for network ${network} with ${resources.length} resources, total items estimate: ${totalItems}`);

    // Apply content URL override if configured
    const overrideBase = env.CONTENT_ORD_NODE_URL || undefined;
    const mapped = overrideBase
      ? resources.map((r) => r.content_url
        ? { ...r, content_url: r.content_url.replace(/^(https?:\/\/[^/]+)(?=\/content\/)/, overrideBase) }
        : r)
      : resources;

    // Return only the fields defined in the non-generic ApiResponse type
    return {
      linkedResources: mapped,
      page: page, // Correctly return the numeric page
      totalItems: totalItems, // Note: Accuracy depends on provider and filtering
      itemsPerPage: limit,
      // No 'error' field on success
    };
  } catch (error) {
    console.error('Error fetching resources:', error);
    // Re-throw the error to be handled by the Elysia onError handler
    throw error; 
  }
}

/**
 * Get a single resource by its DID or inscription ID
 */
export const getResourceById = async (id: string): Promise<ApiResponse> => {
  try {
    // Assuming default network 'mainnet' if not specified by route
    const provider = getProvider('mainnet'); // TODO: Need network context here!
    if (!provider) {
      throw new Error(`Resource provider not available or configured for network: mainnet`);
    }
    const resource = await provider.resolve(id);

    // Return success structure (no error field)
    const overrideBase = env.CONTENT_ORD_NODE_URL || undefined;
    const resourceWithOverride = overrideBase && resource?.content_url
      ? { ...resource, content_url: resource.content_url.replace(/^(https?:\/\/[^/]+)(?=\/content\/)/, overrideBase) }
      : resource;
    return {
      linkedResources: [resourceWithOverride],
      page: 1, // Or appropriate values if single resource has page context?
      totalItems: 1,
      itemsPerPage: 1,
    };
  } catch (error) {
    console.error(`Error fetching resource by ID ${id}:`, error);
    // Re-throw the error
    throw error; 
  }
}

/**
 * Get resources associated with a specific DID
 */
export const getResourcesByDid = async (didId: string): Promise<ApiResponse> => {
  try {
    // Assuming default network 'mainnet' if not specified by route
    const provider = getProvider('mainnet'); // TODO: Need network context here!
    if (!provider) {
      throw new Error(`Resource provider not available or configured for network: mainnet`);
    }
    const resources = await provider.resolveCollection(didId, {});
    const overrideBase = env.CONTENT_ORD_NODE_URL || undefined;
    const mapped = overrideBase
      ? resources.map((r) => r.content_url
        ? { ...r, content_url: r.content_url.replace(/^(https?:\/\/[^/]+)(?=\/content\/)/, overrideBase) }
        : r)
      : resources;

    // Return success structure (no error field)
    return {
      linkedResources: mapped,
      page: 1, // Assuming resolveCollection doesn't paginate?
      totalItems: mapped.length,
      itemsPerPage: mapped.length, 
    };
  } catch (error) {
    console.error(`Error fetching resources for DID ${didId}:`, error);
    // Re-throw the error
    throw error; 
  }
}

/**
 * Create a resource transaction using the core ordinalsplus package
 * 
 * This implementation delegates to the createResourceTransaction function
 * from the ordinalsplus package, which handles all the PSBT creation logic.
 */
// export const createResourcePsbt = async (params: ResourceCreationParams): Promise<ResourceCreationResult> => {
//   console.log(`[createResourcePsbt] Creating resource PSBT for network: ${params.network}`);
  
//   try {
//     // Delegate to the ordinalsplus package function
//     const result = await createResourceTransaction(params);
    
//     console.log(`[createResourcePsbt] Successfully created resource PSBTs`);
//     return result;
//   } catch (error) {
//     console.error(`[createResourcePsbt] Error creating resource PSBTs:`, error);
//     // Re-throw the error to be handled by the Elysia onError handler
//     throw error;
//   }
// }

/* Commenting out unused/problematic helper functions - Start

// Helper function to determine resource type from content type
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

// Helper function to create a DID object
const createDid = (didId: string): DID => { // Requires DID type
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

// Helper function to check if a string is a valid BTCO DID
const isValidBtcoDid = (didString: string | undefined | null): boolean => {
  return Boolean(didString && didString.startsWith('did:btco:'));
}

// Create a function to fetch inscriptions by DID
const fetchInscriptionsByDid = async (didId: string | undefined | null): Promise<Inscription[]> => { // Requires Inscription type
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
    
    const inscription = await fetchInscriptionById(inscriptionId); // Requires fetchInscriptionById
    
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

Commenting out unused/problematic helper functions - End */ 