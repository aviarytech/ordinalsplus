import { DID, LinkedResource, ApiResponse } from '../types';
import { mapApiResponse } from '../adapters/mapApiData';

interface OrdiscanConfig {
  baseUrl: string;
  apiKey?: string; // No longer needed as API keys are managed by the backend
}

interface OrdiscanInscription {
  id?: string;
  number?: number;
  address?: string;
  output?: string;
  content?: string | Record<string, unknown>;
  content_type?: string;
  content_length?: number;
  timestamp?: string;
  [key: string]: unknown; // For any additional properties
}

// This matches the expected format in mapApiData.ts
interface RawDID {
  id?: string;
  inscriptionId?: string;
  contentType?: string;
  content?: unknown;
  resourceType?: string;  // Added for resources
  didReference?: string;  // Added for resources
  sat?: string;           // Added for sat number
}

// Match the expected input format for mapApiResponse
interface RawApiResponse {
  resources?: RawDID[];
  dids?: RawDID[];
  page?: number;
  limit?: number;
  total?: number;
}

interface OrdiscanAddressResponse {
  inscriptions?: OrdiscanInscription[];
  dids?: unknown[];
  page?: number;
  limit?: number;
  total?: number;
  error?: string;
}

class OrdiscanService {
  private baseUrl: string;
  private apiProxyUrl: string;
  
  constructor(config: OrdiscanConfig) {
    this.baseUrl = config.baseUrl.endsWith('/') 
      ? config.baseUrl.slice(0, -1) 
      : config.baseUrl;
      
    // Use the baseUrl from config for all Ordiscan API requests
    this.apiProxyUrl = `${this.baseUrl}/api/ordiscan`;
  }

  /**
   * Fetches inscriptions by address using Ordiscan API
   * @param address Bitcoin address to query
   * @param page Page number
   * @param limit Number of items per page
   */
  async fetchInscriptionsByAddress(address: string, page = 1, limit = 20): Promise<ApiResponse> {
    try {
      let endpoint = '';
      
      if (address) {
        // Use the address/inscriptions endpoint
        endpoint = `/address/${address}/inscriptions`;
      } else {
        // If no address provided, fetch all inscriptions
        endpoint = '/inscriptions';
      }
      
      // Make the API request through our backend proxy
      const url = `${this.apiProxyUrl}${endpoint}?page=${page}&limit=${limit}`;
      console.log(`Fetching from Ordiscan via proxy: ${url}`);
      
      const response = await fetch(url);
      
      // Enhanced error handling
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Ordiscan API error (${response.status}):`, errorText);
        throw new Error(`Ordiscan API error: ${response.status} ${response.statusText}`);
      }
      
      const responseBody = await response.json() as any;
      console.log('Ordiscan API response data format:', Object.keys(responseBody));
      
      if (responseBody.error) {
        throw new Error(`Ordiscan API error: ${responseBody.error}`);
      }
      
      // Handle various possible response formats
      let inscriptions: OrdiscanInscription[] = [];
      
      // The Ordiscan API response structure might have a 'data' property containing the inscriptions
      if (responseBody.data && Array.isArray(responseBody.data)) {
        console.log(`Found inscriptions array in 'data' property, length: ${responseBody.data.length}`);
        inscriptions = responseBody.data;
      } else if (Array.isArray(responseBody)) {
        // If the API returns an array directly
        inscriptions = responseBody;
      } else if (responseBody.inscriptions && Array.isArray(responseBody.inscriptions)) {
        // Standard format with inscriptions array
        inscriptions = responseBody.inscriptions;
      } else if (responseBody.results && Array.isArray(responseBody.results)) {
        // Alternative format with results array
        inscriptions = responseBody.results;
      } else {
        console.warn('Unexpected Ordiscan API response format:', responseBody);
        throw new Error('Unexpected response format from Ordiscan API');
      }
      
      console.log(`Received ${inscriptions.length} inscriptions from Ordiscan API`);
      
      // Transform inscriptions to our format
      const linkedResources = this.convertInscriptionsToResources(inscriptions);
      
      // Find DID documents among inscriptions
      const dids = inscriptions
        .filter(inscription => 
          typeof inscription.content === 'object' && 
          inscription.content !== null && 
          typeof (inscription.content as any).id === 'string' && 
          (inscription.content as any).id.startsWith('did:')
        )
        .map(inscription => this.convertToRawDID(inscription.content));
      
      // Map to our standard format
      const transformedData = {
        linkedResources,
        dids,
        page: responseBody.page || page,
        totalItems: responseBody.total || inscriptions.length || 0,
        itemsPerPage: responseBody.limit || limit,
        error: undefined
      };
      
      return mapApiResponse(transformedData);
    } catch (error) {
      console.error('Error fetching data from Ordiscan:', error);
      return {
        dids: [],
        linkedResources: [],
        page,
        totalItems: 0,
        itemsPerPage: limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Converts API inscriptions to LinkedResources
   * @param inscriptions Inscriptions from the API
   * @returns Array of LinkedResources
   */
  private convertInscriptionsToResources(inscriptions: OrdiscanInscription[]): LinkedResource[] {
    return inscriptions.map(inscription => {
      // Extract sat number from different possible fields
      const satNumber = 
        inscription.sat_number?.toString() || 
        inscription.sat?.toString() || 
        (inscription.sat_ordinal && String(inscription.sat_ordinal).match(/(\d+)/) 
          ? String(inscription.sat_ordinal).match(/(\d+)/)![1] 
          : undefined);
          
      // Create the resource ID
      const resourceId = this.createResourceIdForInscription(inscription);
      
      // Infer resource type from content type
      const resourceType = this.inferResourceTypeFromInscription(inscription);
      
      // Get content type or default to application/json
      const contentType = inscription.content_type || 'application/json';
      
      // Extract possible DID reference
      const didReference = this.extractDidReferenceFromInscription(inscription);
      
      // Create the LinkedResource object
      return {
        id: resourceId,
        resourceId,
        type: resourceType,
        resourceType,
        didReference,
        did: didReference || resourceId, // Use didReference if available or resourceId as fallback
        inscriptionId: (inscription.id || inscription.inscription_id || '').toString(),
        contentType,
        content: inscription.content || {},
        createdAt: inscription.timestamp || new Date().toISOString(),
        sat: satNumber // Add the satoshi number as string
      };
    });
  }
  
  /**
   * Creates a resource ID for an inscription
   * @param inscription The inscription to create a resource ID for
   * @returns A properly formatted resource ID
   */
  private createResourceIdForInscription(inscription: OrdiscanInscription): string {
    // Extract sat number from sat_number or sat or sat_ordinal field
    if (inscription.sat_number || inscription.sat || inscription.sat_ordinal) {
      const satNumber = 
        inscription.sat_number || 
        inscription.sat || 
        (inscription.sat_ordinal && String(inscription.sat_ordinal).match(/(\d+)/) 
          ? String(inscription.sat_ordinal).match(/(\d+)/)![1] 
          : null);
          
      if (!satNumber) {
        console.warn('Could not extract sat number from inscription:', inscription.id);
        return (inscription.id || inscription.inscription_id || '').toString();
      }
      
      // Extract output index from inscription ID
      let outputIndex = 0;
      const idToUse = inscription.id || inscription.inscription_id;
      
      if (idToUse) {
        const match = idToUse.toString().match(/^[0-9a-f]+i(\d+)$/);
        if (match && match[1]) {
          outputIndex = parseInt(match[1], 10);
        }
      }
      
      return `did:btco:${satNumber}/${outputIndex}`;
    }
    
    // For backwards compatibility only - log warning
    console.warn('Inscription missing sat number, cannot create proper DID format:', 
      inscription.id || inscription.inscription_id);
    // This should eventually be removed once all inscriptions have sat numbers
    return (inscription.id || inscription.inscription_id || '').toString();
  }
  
  /**
   * Converts an unknown object to a RawDID
   * @param did The unknown object to convert
   * @returns A RawDID object
   */
  private convertToRawDID(did: unknown): RawDID {
    // Try to convert unknown to RawDID
    if (typeof did === 'object' && did !== null) {
      const didObj = did as Record<string, unknown>;
      return {
        id: typeof didObj.id === 'string' ? didObj.id : '',
        inscriptionId: typeof didObj.inscriptionId === 'string' ? didObj.inscriptionId : '',
        contentType: typeof didObj.contentType === 'string' ? didObj.contentType : 'application/json',
        content: didObj.content || {},
        resourceType: typeof didObj.resourceType === 'string' ? didObj.resourceType : undefined,
        didReference: typeof didObj.didReference === 'string' ? didObj.didReference : undefined,
        sat: typeof didObj.sat === 'string' ? didObj.sat : undefined
      };
    }
    
    return {
      id: '',
      inscriptionId: '',
      contentType: 'application/json',
      content: {}
    };
  }
  
  /**
   * Fetches a specific inscription by its ID
   * @param inscriptionId The inscription ID to fetch
   */
  async fetchInscriptionById(inscriptionId: string): Promise<OrdiscanInscription> {
    try {
      // Use backend proxy to handle the API key securely
      const response = await fetch(
        `${this.apiProxyUrl}/inscription/${inscriptionId}`
      );
      
      if (!response.ok) {
        throw new Error(`Ordiscan API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as OrdiscanInscription;
    } catch (error) {
      console.error('Error fetching inscription from Ordiscan:', error);
      throw error;
    }
  }
  
  /**
   * Infer the resource type from an inscription
   * @param inscription The inscription to infer type from
   */
  private inferResourceTypeFromInscription(inscription: OrdiscanInscription): string {
    // Try to infer from content type (handle different field names)
    const contentTypeValue = inscription.content_type || 
      (inscription.contentType as string | undefined) || '';
    
    // Ensure contentType is always a string
    const contentType = typeof contentTypeValue === 'string' ? contentTypeValue : '';
    
    if (contentType.includes('image')) return 'image';
    if (contentType.includes('video')) return 'video';
    if (contentType.includes('audio')) return 'audio';
    
    // For text content, we need to look at the actual content
    if (contentType.includes('text/plain') || contentType.includes('text/html')) {
      // If it's a text content, we should check if it's a DID document or contains JSON
      if (typeof inscription.content === 'string') {
        // Check if the text content appears to be JSON
        try {
          if (inscription.content.trim().startsWith('{') && inscription.content.trim().endsWith('}')) {
            // Try to parse it as JSON
            const jsonContent = JSON.parse(inscription.content);
            
            // Check for DID document
            if (jsonContent.id && typeof jsonContent.id === 'string' && jsonContent.id.startsWith('did:btco:')) {
              return 'identity';
            }
            
            // Check for credential
            if (jsonContent.credentialSubject) return 'credential';
            
            // It's structured data but not a specific known type
            return 'data';
          }
          
          // Check if it's a DID reference in plain text
          if (inscription.content.includes('did:btco:')) {
            return 'identity-reference';
          }
        } catch (e) {
          // Not valid JSON, continue with other checks
        }
      }
    }
    
    // Try to infer from content if it's a JSON
    if ((contentType.includes('json') || contentType === '') && typeof inscription.content === 'object') {
      const content = inscription.content as Record<string, unknown>;
      
      // Look for type field in the content
      if (content.type && typeof content.type === 'string') return content.type;
      if (content.resourceType && typeof content.resourceType === 'string') return content.resourceType;
      
      // Check for DID document
      if (content.id && typeof content.id === 'string' && content.id.startsWith('did:btco:')) {
        return 'identity';
      }
      
      // Check for credential
      if (content.credentialSubject) return 'credential';
    }
    
    // For text content that didn't match any specific type
    if (contentType.includes('text/')) {
      return 'text';
    }
    
    return 'unknown';
  }
  
  /**
   * Extract DID reference from inscription
   * @param inscription The inscription to extract DID reference from
   */
  private extractDidReferenceFromInscription(inscription: OrdiscanInscription): string | undefined {
    // If it's a JSON with DID reference
    if (typeof inscription.content === 'object') {
      const content = inscription.content as Record<string, unknown>;
      
      if (typeof content.id === 'string' && content.id.startsWith('did:btco:')) {
        return content.id;
      }
      
      if (typeof content.didReference === 'string') {
        return content.didReference;
      }
      
      // Look for reference to a DID in issuer field (for credentials)
      if (typeof content.issuer === 'string' && content.issuer.startsWith('did:btco:')) {
        return content.issuer;
      }
    }
    
    // Try to find DID in content as text
    if (typeof inscription.content === 'string') {
      const didMatch = inscription.content.match(/did:btco:[a-f0-9]+/i);
      return didMatch ? didMatch[0] : undefined;
    }
    
    return undefined;
  }
  
  /**
   * Check if Ordiscan API is available
   */
  async checkApiStatus(): Promise<boolean> {
    try {
      // Check API status through our backend proxy
      const response = await fetch(`${this.apiProxyUrl}/status`, {
        // Set a timeout to avoid waiting too long
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch (error) {
      console.error('Ordiscan API status check failed:', error);
      return false;
    }
  }

  /**
   * Fetches all inscriptions regardless of address
   */
  async fetchAllInscriptions(page = 1, limit = 20): Promise<ApiResponse> {
    // Delegate to fetchInscriptionsByAddress with empty address
    // This ensures consistent handling of response formats
    return this.fetchInscriptionsByAddress('', page, limit);
  }
}

export default OrdiscanService; 