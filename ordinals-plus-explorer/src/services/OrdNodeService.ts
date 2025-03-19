import { ApiResponse, LinkedResource, DID } from '../types';
import { mapApiResponse } from '../adapters/mapApiData';
import { createResourceIdFromInscription } from '../../../ordinalsplus/src/utils/validators';

interface OrdNodeConfig {
  baseUrl: string;
  apiKey?: string;
}

interface OrdInscription {
  id: string;
  number: number;
  address?: string;
  content_type?: string;
  content?: unknown;
  genesis_address?: string;
  genesis_fee?: number;
  genesis_height?: number;
  genesis_transaction?: string;
  timestamp?: string;
  value?: number;
  sat?: string;
  [key: string]: unknown; // For any additional properties
}

interface OrdAddressResponse {
  inscriptions: string[];
  outputs?: string[];
  sat_balance?: number;
  runes_balances?: unknown[];
  [key: string]: unknown;
}

interface OrdStatusResponse {
  chain: string;
  height: number;
  inscriptions: number;
  [key: string]: unknown;
}

/**
 * Helper to convert our internal data model to the application's LinkedResource format
 */
function convertToLinkedResource(inscription: OrdInscription, type: string, didReference?: string): LinkedResource {
  // Process the content to ensure it matches the expected type
  let processedContent: string | Record<string, unknown>;
  
  if (typeof inscription.content === 'string') {
    processedContent = inscription.content;
  } else if (typeof inscription.content === 'object' && inscription.content !== null) {
    processedContent = inscription.content as Record<string, unknown>;
  } else {
    // Default empty object for null or undefined content
    processedContent = {};
  }
  
  // Generate the proper resource ID using the sat number if available
  // If not available, fall back to using the inscription ID
  const resourceId = createResourceIdFromInscription({
    sat: inscription.sat,
    id: inscription.id,
    number: inscription.number
  }) || inscription.id;
  
  return {
    id: inscription.id, // Keep the inscription ID as the unique identifier
    resourceId: resourceId, // Use the proper sat-based resource ID
    inscriptionId: inscription.id,
    type: type,
    resourceType: type, // Both fields use the same value for now
    did: didReference || '',
    didReference: didReference,
    contentType: inscription.content_type || 'application/json',
    content: processedContent,
    createdAt: inscription.timestamp || new Date().toISOString()
  };
}

/**
 * Helper to convert our internal data model to the application's DID format
 */
function convertToDID(inscription: OrdInscription, id: string, controller: string): DID {
  // If no explicit id is provided but sat is available, create a proper DID
  // The DID doesn't include the output index, just the sat number
  const didId = id || (inscription.sat ? `did:btco:${inscription.sat}` : `did:btco:${inscription.id}`);
  
  return {
    id: didId,
    inscriptionId: inscription.id,
    contentType: inscription.content_type || 'application/json',
    content: (typeof inscription.content === 'object' && inscription.content !== null) 
      ? inscription.content as Record<string, unknown>
      : { id: didId, controller }
  };
}

class OrdNodeService {
  private baseUrl: string;
  private apiKey?: string;
  
  constructor(config: OrdNodeConfig) {
    this.baseUrl = config.baseUrl.endsWith('/')
      ? config.baseUrl.slice(0, -1)
      : config.baseUrl;
    this.apiKey = config.apiKey;
  }

  /**
   * Fetches inscriptions by address
   * If an empty address is provided, fetches all inscriptions
   * @param address Bitcoin address to query (empty string for all inscriptions)
   * @param page Page number (0-based index)
   * @param limit Number of items per page
   */
  async fetchInscriptionsByAddress(address: string, page = 0, limit = 20): Promise<ApiResponse> {
    try {
      console.log(`Fetching inscriptions for ${address ? `address: ${address}` : 'all inscriptions'}, page: ${page}, limit: ${limit}`);
      
      // If address is empty, fetch all inscriptions
      if (!address) {
        try {
          // Get all inscriptions from the /inscriptions endpoint
          const inscriptionsResponse = await this.fetchRequestWithJson<{ids: string[]; more: boolean; page_index: number}>('/inscriptions');
          console.log('All inscriptions response:', inscriptionsResponse);
          
          if (!inscriptionsResponse || !Array.isArray(inscriptionsResponse.ids) || inscriptionsResponse.ids.length === 0) {
            console.log('No inscriptions found or invalid response:', inscriptionsResponse);
            return {
              dids: [],
              linkedResources: [],
              page: page,
              totalItems: 0,
              itemsPerPage: limit,
              error: 'No inscriptions found'
            };
          }
          
          // Calculate pagination
          const startIdx = page * limit;
          const endIdx = Math.min(startIdx + limit, inscriptionsResponse.ids.length);
          const paginatedIds = inscriptionsResponse.ids.slice(startIdx, endIdx);
          console.log(`Processing inscriptions ${startIdx}-${endIdx} of ${inscriptionsResponse.ids.length}:`, paginatedIds);
          
          // Fetch details for each inscription
          const inscriptionPromises = paginatedIds.map(id => this.fetchInscriptionById(id));
          const inscriptions = await Promise.all(inscriptionPromises);
          console.log('Fetched inscription details:', inscriptions);
          
          // Transform data into the expected format
          const linkedResources: LinkedResource[] = [];
          const dids: DID[] = [];
          
          // Process each inscription
          for (const inscription of inscriptions) {
            // For image inscriptions, set the content URL
            let processedContent: unknown = inscription.content;
            
            if (inscription.content_type?.startsWith('image/')) {
              try {
                const contentUrl = `${this.baseUrl}/content/${inscription.id}`;
                console.log(`Setting image URL for inscription ${inscription.id}: ${contentUrl}`);
                processedContent = contentUrl;
              } catch (error) {
                console.error(`Error creating data URL for image inscription ${inscription.id}:`, error);
              }
            }
            
            const resourceType = this.inferResourceTypeFromContent(inscription);
            const didReference = this.extractDidReferenceFromContent(inscription);
            
            // Create the LinkedResource object using our helper function
            const resource = convertToLinkedResource({
              ...inscription,
              content: processedContent
            }, resourceType, didReference);
            
            // If this is a DID inscription, also add it to the DIDs array
            if (resourceType === 'did') {
              dids.push(convertToDID(
                inscription, 
                didReference || '', 
                typeof inscription.content === 'object' && 
                inscription.content && 
                'controller' in inscription.content ? 
                String(inscription.content.controller) : 
                ''
              ));
            }
            
            linkedResources.push(resource);
          }
          
          return {
            dids,
            linkedResources,
            page: page,
            totalItems: inscriptionsResponse.ids.length,
            itemsPerPage: limit,
            error: undefined
          };
        } catch (error) {
          console.error('Error fetching all inscriptions:', error);
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
      
      // Original code for fetching by address
      const addressResponse = await this.fetchRequestWithJson<OrdAddressResponse>(`/address/${address}`);
      console.log('Address response:', addressResponse);
      
      if (!addressResponse || !Array.isArray(addressResponse.inscriptions) || addressResponse.inscriptions.length === 0) {
        console.log('No inscriptions found for address or invalid response:', addressResponse);
        return {
          dids: [],
          linkedResources: [],
          page: page,
          totalItems: 0,
          itemsPerPage: limit,
          error: 'No inscriptions found for this address'
        };
      }
      
      // Calculate pagination
      const startIdx = page * limit;
      const endIdx = Math.min(startIdx + limit, addressResponse.inscriptions.length);
      const paginatedIds = addressResponse.inscriptions.slice(startIdx, endIdx);
      console.log(`Processing inscriptions ${startIdx}-${endIdx} of ${addressResponse.inscriptions.length}:`, paginatedIds);
      
      // Fetch details for each inscription
      const inscriptionPromises = paginatedIds.map(id => this.fetchInscriptionById(id));
      const inscriptions = await Promise.all(inscriptionPromises);
      console.log('Fetched inscription details:', inscriptions);
      
      // Transform data into the expected format
      const linkedResources: LinkedResource[] = [];
      const dids: DID[] = [];
      
      for (const inscription of inscriptions) {
        // For image inscriptions, we need to get a data URL to display them
        let processedContent: unknown = inscription.content;
        
        if (inscription.content_type?.startsWith('image/')) {
          try {
            const contentUrl = `${this.baseUrl}/content/${inscription.id}`;
            console.log(`Setting image URL for inscription ${inscription.id}: ${contentUrl}`);
            processedContent = contentUrl;
          } catch (error) {
            console.error(`Error creating data URL for image inscription ${inscription.id}:`, error);
          }
        }
        
        const resourceType = this.inferResourceTypeFromContent(inscription);
        const didReference = this.extractDidReferenceFromContent(inscription);
        
        // Create the LinkedResource object using our helper function
        const resource = convertToLinkedResource({
          ...inscription,
          content: processedContent
        }, resourceType, didReference);
        
        // If this is a DID inscription, also add it to the DIDs array
        if (resourceType === 'did') {
          dids.push(convertToDID(
            inscription, 
            didReference || '', 
            typeof inscription.content === 'object' && 
            inscription.content && 
            'controller' in inscription.content ? 
            String(inscription.content.controller) : 
            address
          ));
        }
        
        linkedResources.push(resource);
      }
      
      // Transform data into the expected format
      const transformedData = {
        dids,
        linkedResources,
        page: page,
        totalItems: addressResponse.inscriptions.length,
        itemsPerPage: limit,
        error: undefined
      };

      console.log('Transformed data:', transformedData);
      return mapApiResponse(transformedData);
    } catch (error) {
      console.error('Error fetching data from Ord node:', error);
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
   * Fetches a specific inscription by its ID
   * @param inscriptionId The inscription ID to fetch
   */
  async fetchInscriptionById(inscriptionId: string): Promise<OrdInscription> {
    try {
      // Fetch the inscription metadata
      console.log(`Fetching inscription by ID: ${inscriptionId}`);
      const inscription = await this.fetchRequestWithJson<OrdInscription>(`/inscription/${inscriptionId}`);
      console.log(`Inscription metadata:`, inscription);
      
      // For this implementation, we'll not try to fetch the content separately 
      // as it's better to render images directly from the Ord node URL
      return inscription;
    } catch (error) {
      console.error('Error fetching inscription:', error);
      throw error;
    }
  }

  /**
   * Fetches the content of an inscription by its ID
   * @param inscriptionId The inscription ID to fetch content for
   */
  async fetchInscriptionContent(inscriptionId: string): Promise<unknown> {
    try {
      // Get content with appropriate accept header based on content type
      const inscription = await this.fetchRequestWithJson<OrdInscription>(`/inscription/${inscriptionId}`);
      const contentType = inscription.content_type || 'application/json';
      
      // Use the proper endpoint for content
      const response = await fetch(`${this.baseUrl}/content/${inscriptionId}`, {
        headers: {
          'Accept': contentType,
          ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
        }
      });

      if (!response.ok) {
        throw new Error(`Error fetching inscription content: ${response.status} ${response.statusText}`);
      }
      
      // Handle different content types appropriately
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      
      if (contentType.includes('text/')) {
        return await response.text();
      }
      
      // For binary data, convert to a data URL
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error fetching inscription content:', error);
      throw error;
    }
  }

  /**
   * Helper method to make requests with JSON response
   */
  private async fetchRequestWithJson<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    console.log(`Fetching from Ord node: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    if (!response.ok) {
      throw new Error(`Error fetching from ${url}: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Helper method to infer resource type from content
   */
  private inferResourceTypeFromContent(inscription: OrdInscription): string {
    // Try to determine type from content or metadata
    try {
      // If it's a DID document, it might contain type information
      if (inscription.content && typeof inscription.content === 'object') {
        const contentObj = inscription.content as Record<string, unknown>;
        
        if (contentObj.type && typeof contentObj.type === 'string') return contentObj.type;
        if (contentObj.resourceType && typeof contentObj.resourceType === 'string') return contentObj.resourceType;
        
        // Check for DID document structure
        if (contentObj.id && typeof contentObj.id === 'string' && 
            contentObj.id.startsWith('did:btco:')) {
          return 'did';
        }
        
        // Look for standard linked resource properties
        if (
          (contentObj.didReference && typeof contentObj.didReference === 'string') || 
          (contentObj.did && typeof contentObj.did === 'string')
        ) {
          return 'linkedResource';
        }
      }
      
      // Fallback to inferring from content type
      if (inscription.content_type) {
        if (inscription.content_type.includes('image')) return 'image';
        if (inscription.content_type.includes('profile')) return 'profile';
        if (inscription.content_type.includes('credential')) return 'credential';
      }
    } catch (e) {
      console.error('Error inferring resource type:', e);
    }
    
    // Default fallback
    return 'unknown';
  }

  /**
   * Helper method to extract DID reference from content
   */
  private extractDidReferenceFromContent(inscription: OrdInscription): string | undefined {
    // Try to extract a DID reference from the content
    try {
      // If this is a DID document itself, create a proper DID reference
      if (inscription.content && typeof inscription.content === 'object') {
        const contentObj = inscription.content as Record<string, unknown>;
        
        // If it's a direct DID reference
        if (contentObj.didReference && typeof contentObj.didReference === 'string') {
          return contentObj.didReference;
        }
        
        if (contentObj.did && typeof contentObj.did === 'string') {
          return contentObj.did;
        }
        
        // If it is a DID document itself
        if (contentObj.id && typeof contentObj.id === 'string' && 
            contentObj.id.startsWith('did:btco:')) {
          return contentObj.id;
        }
      }
      
      // If the content is a string, try to extract a DID
      if (typeof inscription.content === 'string') {
        const didMatch = inscription.content.match(/did:btco:[a-f0-9]+/i);
        return didMatch ? didMatch[0] : undefined;
      }
      
      // If sat is available but no explicit DID reference, create one
      if (inscription.sat) {
        return createResourceIdFromInscription({
          sat: inscription.sat,
          id: inscription.id,
          number: inscription.number
        })?.split('/')[0];
      }
    } catch (e) {
      console.error('Error extracting DID reference:', e);
    }
    
    return undefined;
  }

  /**
   * Check if the Ord node service is available
   */
  async checkNodeStatus(): Promise<boolean> {
    try {
      const statusResponse = await this.fetchRequestWithJson<OrdStatusResponse>('/status');
      return !!statusResponse && typeof statusResponse === 'object';
    } catch (error) {
      console.error('Ord node status check failed:', error);
      return false;
    }
  }

  /**
   * Fetches all inscriptions regardless of address
   * This method directly calls the /inscriptions endpoint of the ORD Node API
   */
  async fetchAllInscriptions(page = 0, limit = 20): Promise<ApiResponse> {
    try {
      const path = `/inscriptions?limit=${limit}&offset=${page * limit}`;
      const response = await this.fetchRequestWithJson<{ inscriptions: OrdInscription[] }>(path);
      
      if (!response || !response.inscriptions || !Array.isArray(response.inscriptions)) {
        return {
          dids: [],
          linkedResources: [],
          page,
          totalItems: 0,
          itemsPerPage: limit,
          error: 'Invalid response format from Ord node'
        };
      }
      
      // Process inscriptions to find DIDs and LinkedResources
      const dids: DID[] = [];
      const linkedResources: LinkedResource[] = [];
      
      for (const inscription of response.inscriptions) {
        // If this is a DID inscription (content is a DID document)
        const didMatch = this.isDIDInscription(inscription);
        if (didMatch) {
          const didId = didMatch.id || `did:btco:${inscription.id}`;
          const controller = didMatch.controller || didMatch.verificationMethod?.[0]?.controller || '';
          
          // Add to DIDs array
          dids.push(convertToDID(inscription, didId, controller));
        }
        
        // Determine the resource type based on content
        const resourceType = this.inferResourceTypeFromContent(inscription);
        
        // Extract DID reference if available
        const didReference = this.extractDidReferenceFromContent(inscription);
        
        // Add to linked resources array
        linkedResources.push(convertToLinkedResource(inscription, resourceType, didReference));
      }
      
      // Mapping to the API response format
      return {
        dids,
        linkedResources,
        page,
        totalItems: 1000, // This is a placeholder, the ORD API doesn't always provide total count
        itemsPerPage: limit
      };
    } catch (error) {
      console.error('Error fetching all inscriptions:', error);
      return {
        dids: [],
        linkedResources: [],
        page,
        totalItems: 0,
        itemsPerPage: limit,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Check if an inscription contains a DID document
   * @param inscription The inscription to check
   * @returns The DID document object if found, otherwise null
   */
  private isDIDInscription(inscription: OrdInscription): { id: string, controller?: string, verificationMethod?: any[] } | null {
    if (!inscription.content || typeof inscription.content !== 'object') {
      return null;
    }
    
    const content = inscription.content as Record<string, any>;
    
    // Check if this looks like a DID document
    if (content.id && typeof content.id === 'string' && content.id.startsWith('did:')) {
      return content as { id: string, controller?: string, verificationMethod?: any[] };
    }
    
    return null;
  }
}

export default OrdNodeService; 