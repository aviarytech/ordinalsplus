import { DID, LinkedResource, ExplorerState } from '../types';

const API_BASE_URL = 'http://localhost:3000/api';

interface ApiResponse {
  dids: DID[];
  linkedResources: LinkedResource[];
  page?: number;
  totalItems?: number;
  itemsPerPage?: number;
  error?: string;
}

export const exploreBtcoDids = async (): Promise<ExplorerState> => {
  try {
    const response = await fetch(`${API_BASE_URL}/explore`);
    
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
};

/**
 * Create a new linked resource associated with a DID
 */
export const createLinkedResource = async (
  resourceData: Record<string, unknown>,
  didReference?: string
): Promise<LinkedResource> => {
  try {
    // Prepare the request data
    const requestData = {
      ...resourceData,
      ...(didReference && { didReference })
    };
    
    const response = await fetch(`${API_BASE_URL}/resources`, {
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
    
    return data.data as LinkedResource;
  } catch (error) {
    console.error('Error creating linked resource:', error);
    throw error;
  }
};

/**
 * Retrieve a linked resource by its DID
 */
export const getResourceByDid = async (didId: string): Promise<LinkedResource> => {
  try {
    const response = await fetch(`${API_BASE_URL}/resources/${encodeURIComponent(didId)}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.status === 'error' || !data.data) {
      throw new Error(data.message || 'Unknown error occurred');
    }
    
    return data.data as LinkedResource;
  } catch (error) {
    console.error(`Error retrieving resource for DID ${didId}:`, error);
    throw error;
  }
}; 