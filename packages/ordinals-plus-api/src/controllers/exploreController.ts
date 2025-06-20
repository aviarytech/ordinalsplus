import { fetchInscriptions } from '../services/ordinalsService';
import { createDidFromInscription, isValidDid } from '../services/didService';
import { processInscriptionsForLinkedResources } from '../services/linkedResourcesService';
import type { ExplorerApiResponse, DID } from '../types';
import { env } from '../config/envConfig';

// Simple cache to avoid refetching on every request
let cachedResponse: ExplorerApiResponse | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export const exploreDidsOrd = async (page = 0, itemsPerPage = 50): Promise<ExplorerApiResponse> => {
  try {
    // Check if API key is set
    if (!env.ORDISCAN_API_KEY) {
      console.error('ORDISCAN_API_KEY is not set in environment variables.');
      return {
        dids: [],
        linkedResources: [],
        error: 'API key not configured. Please set the ORDISCAN_API_KEY environment variable.'
      };
    }
    
    // Check cache if on first page and cache is still valid
    const now = Date.now();
    if (page === 0 && cachedResponse && (now - cacheTimestamp) < CACHE_TTL) {
      console.log('Returning cached response (cache age: ' + Math.round((now - cacheTimestamp)/1000) + ' seconds)');
      return cachedResponse;
    }
    
    console.log(`Fetching inscriptions (page ${page}, size ${itemsPerPage})`);
    
    // Calculate offset based on page
    const offset = page * itemsPerPage;
    
    // Fetch inscriptions
    let inscriptionsResponse;
    try {
      inscriptionsResponse = await fetchInscriptions(offset, itemsPerPage);
      console.log(`Found ${inscriptionsResponse.results.length} inscriptions.`);
    } catch (error) {
      console.error('Error fetching inscriptions:', error);
      return {
        dids: [],
        linkedResources: [],
        error: `Error fetching inscriptions: ${error instanceof Error ? error.message : String(error)}`
      };
    }
    
    // Process all inscriptions
    const inscriptions = inscriptionsResponse.results;
    
    // Create a map to store potential DID references for resources
    const didReferences = new Map<string, string>();
    
    // Extract DIDs using the new translation function
    const dids: DID[] = [];
    for (const inscription of inscriptions) {
      // First check if this inscription contains DID-format content
      if (
        inscription.content && 
        typeof inscription.content === 'object' &&
        inscription.content !== null
      ) {
        const content = inscription.content as Record<string, unknown>;
        if (
          content.id && 
          typeof content.id === 'string' &&
          isValidDid(content.id)
        ) {
          // This is a proper DID inscription, create a full DID object
          const did = createDidFromInscription(inscription);
          dids.push(did);
          
          // Store the DID-to-inscription mapping for resource linking
          didReferences.set(inscription.id, did.id);
        }
      }
    }
    
    console.log(`Successfully created ${dids.length} valid DIDs.`);
    
    // Process linked resources using the new function
    const linkedResources = processInscriptionsForLinkedResources(inscriptions, didReferences);
    console.log(`Successfully created ${linkedResources.length} linked resources.`);
    
    // Prepare response
    const response = {
      dids,
      linkedResources,
      page,
      totalItems: inscriptionsResponse.total,
      itemsPerPage
    };
    
    // Cache first page results
    if (page === 0) {
      cachedResponse = response;
      cacheTimestamp = now;
    }
    
    return response;
  } catch (error) {
    console.error('Error exploring inscriptions:', error);
    return {
      dids: [],
      linkedResources: [],
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}; 