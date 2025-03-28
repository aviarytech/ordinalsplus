import { ApiResponse } from '../types';
import OrdNodeService from './OrdNodeService';
import OrdiscanService from './OrdiscanService';

// Define the API Provider types
export enum ApiProviderType {
  ORDISCAN = 'ORDISCAN',
  ORD_NODE = 'ORD_NODE',
}

// Service configuration interface
export interface ApiServiceConfig {
  type: ApiProviderType;
  baseUrl: string;
  apiKey?: string;
}

/**
 * Central service provider class that offers API services based on the configuration
 */
class ApiServiceProvider {
  private static instance: ApiServiceProvider;
  private apiService: OrdNodeService | OrdiscanService;
  private config: ApiServiceConfig;

  private constructor(config: ApiServiceConfig) {
    this.config = config;
    this.apiService = this.createServiceInstance(config);
  }
  
  /**
   * Gets the singleton instance of the API service provider
   */
  public static getInstance(config?: ApiServiceConfig): ApiServiceProvider {
    if (!ApiServiceProvider.instance) {
      if (!config) {
        config = {
          type: ApiProviderType.ORD_NODE,
          baseUrl: 'http://localhost:3000',
        };
      }
      ApiServiceProvider.instance = new ApiServiceProvider(config);
    }
    return ApiServiceProvider.instance;
  }
  
  /**
   * Updates the API service configuration
   */
  public updateConfig(config: ApiServiceConfig): void {
    this.config = config;
    this.apiService = this.createServiceInstance(config);
  }
  
  /**
   * Gets the configuration
   */
  public getConfig(): ApiServiceConfig {
    return this.config;
  }
  
  /**
   * Fetches inscriptions by address
   */
  public async fetchInscriptionsByAddress(
    address: string, 
    page = 1, 
    limit = 20
  ): Promise<ApiResponse> {
    return this.apiService.fetchInscriptionsByAddress(address, page, limit);
  }
  
  /**
   * Fetches all inscriptions regardless of address
   * Currently implemented by fetching from the /inscriptions endpoint
   */
  public async fetchAllInscriptions(
    page = 0,
    limit = 20
  ): Promise<ApiResponse> {
    // Use the new /resources endpoint which properly handles translations through the ordinalsplus package
    try {
      console.log(`Fetching resources from ${this.config.baseUrl}/api/resources?page=${page}&limit=${limit}`);
      const response = await fetch(`${this.config.baseUrl}/api/resources?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        return {
          error: `Error fetching resources: ${response.status} ${response.statusText}`,
          dids: [],
          linkedResources: [],
          page: 0,
          totalItems: 0,
          itemsPerPage: 0
        };
      }
      
      // Parse the response
      const json = await response.json();
      return json.data;
    } catch (error) {
      console.error('Error fetching resources:', error);
      return {
        error: `Error fetching resources: ${error instanceof Error ? error.message : String(error)}`,
        dids: [],
        linkedResources: [],
        page,
        totalItems: 0,
        itemsPerPage: limit
      };
    }
  }
  
  /**
   * Fetch a DID and its associated resources
   * @param didString The DID string to fetch
   * @returns A promise that resolves to the API response containing the DID and linked resources
   */
  public async fetchDid(didString: string): Promise<ApiResponse> {
    try {
      // Use the new dedicated resources endpoint for DIDs
      console.log(`Fetching DID resources from ${this.config.baseUrl}/api/resources/did/${didString}`);
      const response = await fetch(`${this.config.baseUrl}/api/resources/did/${didString}`);
      
      if (!response.ok) {
        return {
          error: `Failed to fetch DID: ${response.status} ${response.statusText}`,
          dids: [],
          linkedResources: [],
          page: 0,
          totalItems: 0,
          itemsPerPage: 0
        };
      }
      
      // Parse the response
      const json = await response.json();
      return json.data;
    } catch (error) {
      console.error('Error fetching DID:', error);
      return {
        error: `Error fetching DID: ${error instanceof Error ? error.message : String(error)}`,
        dids: [],
        linkedResources: [],
        page: 0,
        totalItems: 0,
        itemsPerPage: 0
      };
    }
  }
  
  /**
   * Fetch resources associated with a DID
   * @param didString The DID string to fetch resources for
   * @returns A promise that resolves to the API response containing the linked resources
   */
  public async fetchResourcesByDid(didString: string): Promise<ApiResponse> {
    // Use the dedicated DID resources endpoint
    return this.fetchDid(didString);
  }
  
  /**
   * Fetch content for a specific resource
   * @param resourceId The resource ID to fetch content for
   * @returns A promise that resolves to the resource content or null if not available
   */
  public async fetchResourceContent(resourceId: string): Promise<{content: any, contentType: string} | null> {
    try {
      // Use the resources endpoint to get detailed resource info
      console.log(`Fetching resource content for ${resourceId}`);
      const response = await fetch(`${this.config.baseUrl}/api/resources/${resourceId}`);
      
      if (!response.ok) {
        console.error(`Error fetching resource content: ${response.status} ${response.statusText}`);
        return null;
      }
      
      // Parse the response
      const json = await response.json();
      
      if (!json.data || !json.data.linkedResources || json.data.linkedResources.length === 0) {
        console.error('No resource found in response');
        return null;
      }
      
      // Get the first resource from the response
      const resource = json.data.linkedResources[0];
      
      // Return the content and content type
      return {
        content: resource.content,
        contentType: resource.contentType
      };
    } catch (error) {
      console.error('Error fetching resource content:', error);
      return null;
    }
  }
  
  /**
   * Get the content URL for a specific resource using either DID or inscription ID
   * @param resourceIdentifier The DID or inscription ID to get content for
   */
  public getContentUrl(resourceIdentifier: string): string {
    // Use the new resources API for all content
    const apiPath = '/api/resources';
    
    // Always use our backend URL, never connect directly to external services
    return `${this.config.baseUrl}${apiPath}/${resourceIdentifier}/content`;
  }
  
  /**
   * Get a resource URL from a DID or resource ID 
   * @param didOrResourceId The DID or resource ID
   * @returns The internal ID to use for API calls
   */
  public getInternalIdFromIdentifier(didOrResourceId: string): string {
    // If it's already a DID, just extract the ID part
    if (didOrResourceId.startsWith('did:btco:')) {
      return didOrResourceId.replace('did:btco:', '');
    }
    
    // If it's a resource ID, extract the ID part
    if (didOrResourceId.startsWith('resource:btco:')) {
      return didOrResourceId.replace('resource:btco:', '');
    }
    
    // Otherwise, assume it's already an internal ID
    return didOrResourceId;
  }
  
  /**
   * Fetch text content directly from an inscription
   * @param inscriptionId The inscription ID to get text content for
   * @returns A promise that resolves to the text content or null if not available
   */
  public async fetchTextContent(inscriptionId: string): Promise<string | null> {
    try {
      const contentUrl = this.getContentUrl(inscriptionId);
      const response = await fetch(contentUrl);
      
      if (!response.ok) {
        console.error(`Error fetching text content: ${response.status} ${response.statusText}`);
        return null;
      }
      
      // Get the content type
      const contentType = response.headers.get('Content-Type') || '';
      
      // For text content, return the text directly
      if (contentType.includes('text/') || !contentType || contentType === 'unknown') {
        return await response.text();
      }
      
      // For JSON content, try to stringify it
      if (contentType.includes('application/json')) {
        const json = await response.json();
        return JSON.stringify(json, null, 2);
      }
      
      // For other content types, return null
      return null;
    } catch (error) {
      console.error('Error fetching text content:', error);
      return null;
    }
  }
  
  /**
   * Check if the API service is available
   */
  public async checkApiStatus(): Promise<boolean> {
    try {
      if (this.apiService instanceof OrdNodeService) {
        return await this.apiService.checkNodeStatus();
      } else if (this.apiService instanceof OrdiscanService) {
        return await this.apiService.checkApiStatus();
      }
      return false;
    } catch (error) {
      console.error('Error checking API status:', error);
      return false;
    }
  }
  
  /**
   * Creates the appropriate service instance based on the configuration
   */
  private createServiceInstance(
    config: ApiServiceConfig
  ): OrdNodeService | OrdiscanService {
    switch (config.type) {
      case ApiProviderType.ORD_NODE:
        return new OrdNodeService({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
        });
      case ApiProviderType.ORDISCAN:
        return new OrdiscanService({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
        });
      default:
        throw new Error(`Unsupported API service type: ${config.type}`);
    }
  }
}

export default ApiServiceProvider; 