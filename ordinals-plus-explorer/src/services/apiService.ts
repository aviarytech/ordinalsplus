import { ApiResponse, CoreLinkedResource, ExplorerState } from '../types';

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  /**
   * Get the base URL configuration
   */
  getConfig(): { baseUrl: string } {
    return { baseUrl: this.baseUrl };
  }

  /**
   * Get the content URL for a resource
   */
  getContentUrl(identifier: string): string {
    return `${this.baseUrl}/api/content/${encodeURIComponent(identifier)}`;
  }

  /**
   * Fetch resources by DID
   */
  async fetchResourcesByDid(did: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/resources/did/${encodeURIComponent(did)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching resources by DID:', error);
      throw error;
    }
  }

  /**
   * Fetch resource content
   */
  async fetchResourceContent(identifier: string): Promise<CoreLinkedResource> {
    try {
      const response = await fetch(`${this.baseUrl}/api/content/${encodeURIComponent(identifier)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching resource content:', error);
      throw error;
    }
  }

  /**
   * Explore BTCO DIDs
   */
  async exploreBtcoDids(): Promise<ExplorerState> {
    try {
      const response = await fetch(`${this.baseUrl}/api/explore`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data: ApiResponse = await response.json();
      
      if (data.error) {
        return {
          dids: [],
          linkedResources: [],
          isLoading: false,
          error: data.error,
          currentPage: 0,
          totalItems: 0,
          itemsPerPage: 50
        };
      }
      
      return {
        dids: data.dids,
        linkedResources: data.linkedResources,
        isLoading: false,
        error: null,
        currentPage: data.page || 0,
        totalItems: data.totalItems || 0,
        itemsPerPage: data.itemsPerPage || 50
      };
    } catch (error) {
      console.error('Error exploring DIDs:', error);
      return {
        dids: [],
        linkedResources: [],
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        currentPage: 0,
        totalItems: 0,
        itemsPerPage: 50
      };
    }
  }

  /**
   * Create a new linked resource associated with a DID
   */
  async createLinkedResource(
    resourceData: {
      inscriptionId: string;
      type: string;
      contentType: string;
      content: Record<string, unknown>;
      didReference?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<CoreLinkedResource> {
    try {
      // Ensure inscriptionId is present
      if (!resourceData.inscriptionId) {
        throw new Error('Inscription ID is required for resource creation');
      }

      // Prepare the request data
      const requestData = {
        ...resourceData,
        // Ensure type and contentType are present
        type: resourceData.type || 'resource',
        contentType: resourceData.contentType || 'application/json',
        // Ensure content is present
        content: resourceData.content || {},
        // Add optional fields if present
        ...(resourceData.didReference && { didReference: resourceData.didReference }),
        ...(resourceData.metadata && { metadata: resourceData.metadata })
      };
      
      const response = await fetch(`${this.baseUrl}/api/resources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error' || !data.data) {
        throw new Error(data.message || 'Unknown error occurred');
      }
      
      return data.data as CoreLinkedResource;
    } catch (error) {
      console.error('Error creating linked resource:', error);
      throw error;
    }
  }

  /**
   * Retrieve a linked resource by its DID
   */
  async getResourceByDid(didId: string): Promise<CoreLinkedResource> {
    try {
      const response = await fetch(`${this.baseUrl}/api/resources/${encodeURIComponent(didId)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.status === 'error' || !data.data) {
        throw new Error(data.message || 'Unknown error occurred');
      }
      
      return data.data as CoreLinkedResource;
    } catch (error) {
      console.error(`Error retrieving resource for DID ${didId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches all resources
   */
  async fetchAllResources(page = 1, limit = 20): Promise<ApiResponse> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/resources?page=${page}&limit=${limit}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Handle both direct response and wrapped response formats
      const resources = data.linkedResources || data.data?.linkedResources || [];
      const totalItems = data.totalItems || data.data?.totalItems || resources.length;
      
      return {
        dids: data.dids || data.data?.dids || [],
        linkedResources: resources,
        page: data.page || page,
        totalItems,
        itemsPerPage: data.itemsPerPage || limit,
        error: data.error
      };
    } catch (error) {
      console.error('Error fetching resources from API:', error);
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
   * Fetches a specific resource by ID
   */
  async fetchResourceById(id: string): Promise<ApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/resources/${id}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        dids: data.dids || [],
        linkedResources: data.linkedResources || [],
        page: 1,
        totalItems: 1,
        itemsPerPage: 1,
        error: data.error
      };
    } catch (error) {
      console.error('Error fetching resource from API:', error);
      return {
        dids: [],
        linkedResources: [],
        page: 1,
        totalItems: 0,
        itemsPerPage: 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if API is available
   */
  async checkApiStatus(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/health`);
      return response.ok;
    } catch (error) {
      console.error('Error checking API status:', error);
      return false;
    }
  }
}

export default ApiService; 