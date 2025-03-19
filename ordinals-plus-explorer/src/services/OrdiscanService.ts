import { ApiResponse } from '../types';
import { mapApiResponse } from '../adapters/mapApiData';

interface OrdiscanConfig {
  baseUrl: string;
  apiKey?: string; // Will be ignored - API key is managed by backend
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
  private apiServerUrl: string;
  private apiKey?: string;
  
  constructor(config: OrdiscanConfig) {
    this.apiServerUrl = 'http://localhost:3000'; // Backend API server
    this.apiKey = config.apiKey;
  }

  /**
   * Fetches inscriptions by address using Ordiscan API
   * @param address Bitcoin address to query
   * @param page Page number
   * @param limit Number of items per page
   */
  async fetchInscriptionsByAddress(address: string, page = 1, limit = 20): Promise<ApiResponse> {
    try {
      // Use backend proxy to handle the API key securely
      const response = await fetch(
        `${this.apiServerUrl}/api/ordiscan/address/${address}?page=${page}&limit=${limit}`
      );
      
      const data = await response.json() as OrdiscanAddressResponse;
      
      // Transform Ordiscan API response to our expected format
      const transformedData = {
        linkedResources: data.inscriptions?.map((inscription: OrdiscanInscription) => ({
          id: inscription.id || '',
          inscriptionId: inscription.id || '',
          type: this.inferResourceTypeFromInscription(inscription),
          didReference: this.extractDidReferenceFromInscription(inscription),
          timestamp: inscription.timestamp || new Date().toISOString(),
          contentType: inscription.content_type || 'application/json',
          content: inscription.content || {}
        })) || [],
        // Convert unknown[] to RawDID[] to match the type expected by mapApiResponse
        dids: data.dids?.map(did => this.convertToRawDID(did)) || [],
        page: data.page || page,
        totalItems: data.total || data.inscriptions?.length || 0,
        itemsPerPage: data.limit || limit,
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
        didReference: typeof didObj.didReference === 'string' ? didObj.didReference : undefined
      };
    }
    // Default DID structure if conversion fails
    return {
      id: '',
      inscriptionId: '',
      contentType: 'application/json',
      content: {},
      resourceType: undefined,
      didReference: undefined
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
        `${this.apiServerUrl}/api/ordiscan/inscription/${inscriptionId}`
      );
      
      return response.json() as Promise<OrdiscanInscription>;
    } catch (error) {
      console.error('Error fetching inscription:', error);
      throw error;
    }
  }
  
  /**
   * Infer the resource type from an inscription
   * @param inscription The inscription to infer type from
   */
  private inferResourceTypeFromInscription(inscription: OrdiscanInscription): string {
    // Try to infer from content type
    const contentType = inscription.content_type || '';
    
    if (contentType.includes('image')) return 'image';
    if (contentType.includes('video')) return 'video';
    if (contentType.includes('audio')) return 'audio';
    
    // Try to infer from content if it's a JSON
    if (contentType.includes('json') && typeof inscription.content === 'object') {
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
      // Use backend to check API status
      const response = await fetch(`${this.apiServerUrl}/api/config`);
      const data = await response.json();
      return data?.providers?.ordiscan?.available || false;
    } catch (error) {
      console.error('Ordiscan API status check failed:', error);
      return false;
    }
  }

  /**
   * Fetches all inscriptions regardless of address
   */
  async fetchAllInscriptions(page = 1, limit = 20): Promise<ApiResponse> {
    try {
      const url = `${this.apiServerUrl}/api/ordiscan/inscriptions?page=${page}&limit=${limit}`;
      
      const response = await fetch(url);
      const data = await response.json() as OrdiscanAddressResponse;
      
      if (data.error) {
        return {
          dids: [],
          linkedResources: [],
          page: page,
          totalItems: 0,
          itemsPerPage: limit,
          error: data.error
        };
      }
      
      if (!data.inscriptions || !Array.isArray(data.inscriptions)) {
        return {
          dids: [],
          linkedResources: [],
          page: page,
          totalItems: 0,
          itemsPerPage: limit,
          error: 'Invalid response format from Ordiscan API'
        };
      }
      
      // Process inscriptions to find DIDs and LinkedResources
      const linkedResources: RawDID[] = [];
      const dids: RawDID[] = [];
      
      for (const inscription of data.inscriptions) {
        // Check if this is a DID inscription
        if (
          typeof inscription.content === 'object' &&
          inscription.content !== null &&
          typeof (inscription.content as any).id === 'string' &&
          (inscription.content as any).id.startsWith('did:')
        ) {
          // This is a DID document
          dids.push({
            id: (inscription.content as any).id,
            inscriptionId: inscription.id,
            contentType: inscription.content_type,
            content: inscription.content
          });
        }
        
        // All inscriptions are also considered linked resources
        const resourceType = this.inferResourceTypeFromInscription(inscription);
        const didReference = this.extractDidReferenceFromInscription(inscription);
        
        linkedResources.push({
          id: inscription.id || '',
          inscriptionId: inscription.id || '',
          contentType: inscription.content_type || 'application/json',
          content: inscription.content || {},
          resourceType,
          didReference
        });
      }
      
      // Map to API response format using the adapter
      return mapApiResponse({
        dids,
        linkedResources: linkedResources,
        page: page,
        totalItems: data.total || 0,
        itemsPerPage: limit
      });
    } catch (error) {
      console.error('Error fetching all inscriptions:', error);
      return {
        dids: [],
        linkedResources: [],
        page: page,
        totalItems: 0,
        itemsPerPage: limit,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export default OrdiscanService; 