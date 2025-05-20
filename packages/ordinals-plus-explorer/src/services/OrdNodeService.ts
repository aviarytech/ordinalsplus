import { ResourceContent, ResourceInfo, ResourceMetadata } from 'ordinalsplus';
import { 
  ApiResponse, 
  CoreLinkedResource,
  ResourceCollection,
} from '../types';

interface OrdNodeConfig {
  baseUrl: string;
  apiKey?: string;
}

class OrdNodeService {
  private baseUrl: string;
  
  constructor(config: OrdNodeConfig) {
    this.baseUrl = config.baseUrl.endsWith('/')
      ? config.baseUrl.slice(0, -1)
      : config.baseUrl;
  }

  /**
   * Fetch linked resources by address
   */
  async fetchResourcesByAddress(
    address: string, 
    page = 0, 
    limit = 20
  ): Promise<ApiResponse> {
    try {
      let endpoint = address 
        ? `${this.baseUrl}/api/resources/address/${address}`
        : `${this.baseUrl}/api/resources`;
        
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('page', page.toString());
      url.searchParams.set('limit', limit.toString());
      
      console.log(`Fetching resources: ${url.toString()}`);
      
      const response = await fetch(url.toString(), {
        headers: this.getHeaders(),
        method: 'GET',
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`HTTP error ${response.status}: ${errorText}`);
        return {
          linkedResources: [],
          dids: [],
          page,
          totalItems: 0,
          itemsPerPage: limit,
          error: `API Error (${response.status}): ${errorText || 'Unknown error'}`
        };
      }
      
      const responseBody = await response.json();
      
      return {
        linkedResources: responseBody.linkedResources || [],
        dids: responseBody.dids || [],
        page: responseBody.page || page,
        totalItems: responseBody.totalItems || 0,
        itemsPerPage: responseBody.itemsPerPage || limit,
        error: responseBody.error
      };
    } catch (error) {
      console.error(`Error fetching resources:`, error);
      return {
        linkedResources: [],
        dids: [],
        page,
        totalItems: 0,
        itemsPerPage: limit,
        error: `Failed to connect to the API. ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Fetch a specific resource by its DID
   */
  async fetchResourceById(resourceId: string): Promise<CoreLinkedResource | null> {
    try {
      const endpoint = `${this.baseUrl}/api/resources/${encodeURIComponent(resourceId)}`;
      console.log(`Fetching resource ${resourceId}`);
      
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Resource ${resourceId} not found`);
          return null;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch resource metadata
   */
  async fetchResourceMetadata(resourceId: string): Promise<ResourceMetadata | null> {
    try {
      const endpoint = `${this.baseUrl}/api/resources/${encodeURIComponent(resourceId)}/meta`;
      console.log(`Fetching metadata for resource ${resourceId}`);
      
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Metadata for resource ${resourceId} not found`);
          return null;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching metadata for resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch resource info
   */
  async fetchResourceInfo(resourceId: string): Promise<ResourceInfo | null> {
    try {
      const endpoint = `${this.baseUrl}/api/resources/${encodeURIComponent(resourceId)}/info`;
      console.log(`Fetching info for resource ${resourceId}`);
      
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Info for resource ${resourceId} not found`);
          return null;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching info for resource ${resourceId}:`, error);
      throw error;
    }
  }
  
  /**
   * Fetch resource content
   */
  async fetchResourceContent(resourceId: string): Promise<ResourceContent> {
    try {
      const response = await fetch(`${this.baseUrl}/api/resources/${encodeURIComponent(resourceId)}/content`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get('Content-Type') || '';
      
      if (contentType.includes('application/json')) {
        return {
          content: await response.json(),
          contentType: 'application/json'
        };
      } else if (contentType.includes('text/')) {
        return {
          content: await response.text(),
          contentType: contentType
        };
      } else {
        return {
          content: await response.blob(),
          contentType: contentType
        };
      }
    } catch (error) {
      console.error(`Error fetching resource content ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch a resource collection
   */
  async fetchResourceCollection(collectionId: string): Promise<ResourceCollection | null> {
    try {
      const endpoint = `${this.baseUrl}/api/resources/${encodeURIComponent(collectionId)}/collection`;
      console.log(`Fetching collection ${collectionId}`);
      
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(10000)
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Collection ${collectionId} not found`);
          return null;
        }
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error fetching collection ${collectionId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch heritage collection
   */
  async fetchHeritageCollection(resourceId: string): Promise<ResourceCollection | null> {
    return this.fetchResourceCollection(`${resourceId}/heritage`);
  }

  /**
   * Fetch controller collection
   */
  async fetchControllerCollection(resourceId: string): Promise<ResourceCollection | null> {
    return this.fetchResourceCollection(`${resourceId}/controller`);
  }

  /**
   * Fetch curated collection
   */
  async fetchCuratedCollection(resourceId: string): Promise<ResourceCollection | null> {
    return this.fetchResourceCollection(`${resourceId}/meta`);
  }

  /**
   * Check if the API is available
   */
  async checkNodeStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch (error) {
      console.error('API health check failed:', error);
      return false;
    }
  }
  
  /**
   * Fetch all resources
   */
  async fetchAllResources(page = 0, limit = 20): Promise<ApiResponse> {
    return this.fetchResourcesByAddress('', page, limit);
  }

  /**
   * Get headers for API requests
   */
  private getHeaders(): HeadersInit {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }
}

export default OrdNodeService; 