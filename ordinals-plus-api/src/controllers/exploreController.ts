import { fetchInscriptions } from '../services/ordinalsService';
import { extractDidsFromInscriptions } from '../services/didService';
import { extractLinkedResourcesFromInscriptions } from '../services/linkedResourcesService';
import type { ExplorerApiResponse } from '../types';

// Simple cache to avoid refetching on every request
let cachedResponse: ExplorerApiResponse | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export const exploreDidsOrd = async (page = 0, itemsPerPage = 50): Promise<ExplorerApiResponse> => {
  try {
    // Check if API key is set
    if (!process.env.ORDISCAN_API_KEY) {
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
    
    // Extract DIDs
    const dids = extractDidsFromInscriptions(inscriptions);
    console.log(`Successfully extracted ${dids.length} valid DIDs.`);
    
    // Treat all inscriptions as potential linked resources
    const linkedResources = extractLinkedResourcesFromInscriptions(inscriptions);
    console.log(`Successfully extracted ${linkedResources.length} resources.`);
    
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