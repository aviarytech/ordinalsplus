import fetchClient from '../utils/fetchUtils';
import { env } from '../config/envConfig';

// Collection types
export enum CollectionVisibility {
  PUBLIC = 'public',
  PRIVATE = 'private',
  UNLISTED = 'unlisted'
}

export enum CollectionCategory {
  ART = 'art',
  COLLECTIBLES = 'collectibles',
  PHOTOGRAPHY = 'photography',
  MUSIC = 'music',
  VIDEO = 'video',
  DOCUMENTS = 'documents',
  GAMING = 'gaming',
  MEMES = 'memes',
  OTHER = 'other'
}

export interface CollectionItem {
  did: string;
  inscriptionId?: string;
  order?: number;
  notes?: string;
  addedAt?: string;
  [key: string]: any;
}

export interface CollectionMetadata {
  name: string;
  description: string;
  image?: string;
  category: CollectionCategory;
  tags?: string[];
  visibility: CollectionVisibility;
  createdAt?: string;
  updatedAt?: string;
  inscriptionId?: string;
  [key: string]: any;
}

export interface Collection {
  id: string;
  curatorDid: string;
  metadata: CollectionMetadata;
  items: CollectionItem[];
  credential?: any;
  credentialId?: string;
  accessList?: string[];
}

export interface CreateCollectionParams {
  name: string;
  description: string;
  category: CollectionCategory;
  visibility?: CollectionVisibility;
  curatorDid: string;
  tags?: string[];
  items?: Omit<CollectionItem, 'addedAt'>[];
}

// API client setup
const apiBaseUrl = env.VITE_BACKEND_URL || 'http://localhost:3001/api';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Service for managing collections
 */
export interface CollectionCredentialResponse {
  status: string;
  message?: string;
  data?: {
    credentialId: string;
    credential: any;
  };
}

export interface CollectionVerificationResponse {
  status: string;
  message?: string;
  data?: {
    isValid: boolean;
    verifiedAt: string;
    inscriptionId?: string;
    collectionId?: string;
  };
}

export interface CollectionInscriptionResponse {
  status: string;
  message?: string;
  data?: {
    inscriptionId: string;
    status: string;
    collectionId: string;
  };
}

export interface CollectionInscriptionStatusResponse {
  status: string;
  data?: {
    inscription: {
      id: string;
      collectionId: string;
      requesterDid: string;
      status: string;
      requestedAt: string;
      updatedAt: string;
      completedAt?: string;
      error?: string;
      inscriptionId?: string;
      transactions?: {
        commitTxId?: string;
        revealTxId?: string;
      };
      fees?: {
        feeRate: number;
        total: number;
        commit: number;
        reveal: number;
      };
      batching?: {
        enabled: boolean;
        totalBatches: number;
        completedBatches: number;
        batchInscriptionIds: string[];
      };
    };
  };
}

export const collectionService = {
  /**
   * Create a new collection
   * @param params Collection creation parameters
   * @returns The created collection
   */
  async createCollection(params: CreateCollectionParams): Promise<Collection> {
    const response = await fetchClient.post(`${apiBaseUrl}/collections`, params, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      }
    });
    return response.data;
  },

  /**
   * Get a collection by ID
   * @param id Collection ID
   * @returns The collection
   */
  async getCollection(id: string): Promise<Collection> {
    const response = await fetchClient.get(`${apiBaseUrl}/collections/${id}`, {
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get collections by curator DID
   * @param curatorDid Curator DID
   * @param page Page number
   * @param limit Items per page
   * @returns Collections and pagination info
   */
  async getCollectionsByCurator(curatorDid: string, page = 1, limit = 10): Promise<{
    collections: Collection[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await fetchClient.get(`${apiBaseUrl}/collections`, {
      params: { curatorDid, page: page.toString(), limit: limit.toString() },
      headers: getAuthHeaders()
    });
    return response.data;
  },

  /**
   * Get available inscriptions for a user
   * @param userDid User DID
   * @returns Array of available inscriptions
   */
  async getAvailableInscriptions(_userDid: string): Promise<any[]> {
    // For testing purposes, return mock data
    // In a real implementation, this would call the API
    return [
      {
        did: 'did:ord:btc:1234567890abcdef',
        id: '1',
        title: 'Inscription 1',
        thumbnailUrl: 'https://placehold.co/200x200?text=Inscription+1',
        contentType: 'image/png'
      },
      {
        did: 'did:ord:btc:abcdef1234567890',
        id: '2',
        title: 'Inscription 2',
        thumbnailUrl: 'https://placehold.co/200x200?text=Inscription+2',
        contentType: 'image/png'
      },
      {
        did: 'did:ord:btc:9876543210abcdef',
        id: '3',
        title: 'Inscription 3',
        thumbnailUrl: 'https://placehold.co/200x200?text=Inscription+3',
        contentType: 'image/jpeg'
      },
      {
        did: 'did:ord:btc:fedcba0987654321',
        id: '4',
        title: 'Inscription 4',
        thumbnailUrl: 'https://placehold.co/200x200?text=Inscription+4',
        contentType: 'image/jpeg'
      }
    ];
  },

  /**
   * Get collection categories
   * @returns Array of collection categories
   */
  getCollectionCategories(): { value: string; label: string }[] {
    return Object.entries(CollectionCategory).map(([key, value]) => ({
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase()
    }));
  },

  /**
   * Get collection visibility options
   * @returns Array of visibility options
   */
  getCollectionVisibilityOptions(): { value: string; label: string }[] {
    return Object.entries(CollectionVisibility).map(([key, value]) => ({
      value,
      label: key.charAt(0) + key.slice(1).toLowerCase()
    }));
  },

  /**
   * Issue a credential for a collection
   * @param collectionId Collection ID
   * @param issuerDid Issuer DID
   * @returns Response with credential data
   */
  async issueCollectionCredential(collectionId: string, issuerDid: string): Promise<CollectionCredentialResponse> {
    const response = await fetchClient.post(
      `${apiBaseUrl}/verify/collection-credential/issue`,
      { collectionId, issuerDid },
      {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  },

  /**
   * Get a collection credential by ID
   * @param credentialId Credential ID
   * @returns Response with credential data
   */
  async getCollectionCredential(credentialId: string): Promise<any> {
    const response = await fetchClient.get(
      `${apiBaseUrl}/verify/collection-credential/${credentialId}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Find collection credentials by curator DID
   * @param curatorDid Curator DID
   * @returns Response with credentials data
   */
  async getCollectionCredentialsByCurator(curatorDid: string): Promise<any> {
    const response = await fetchClient.get(
      `${apiBaseUrl}/verify/collection-credentials/curator/${curatorDid}`,
      { headers: getAuthHeaders() }
    );
    return response.data;
  },

  /**
   * Revoke a collection credential
   * @param credentialId Credential ID
   * @param issuerDid Issuer DID
   * @returns Response with revocation status
   */
  async revokeCollectionCredential(credentialId: string, issuerDid: string): Promise<any> {
    const response = await fetchClient.post(
      `${apiBaseUrl}/verify/collection-credential/revoke`,
      { credentialId, issuerDid },
      {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  },

  /**
   * Verify a collection inscription
   * @param inscriptionId Inscription ID
   * @param collectionId Collection ID
   * @returns Verification result
   */
  async verifyCollectionInscription(inscriptionId: string, collectionId: string): Promise<CollectionVerificationResponse> {
    const response = await fetchClient.get(
      `${apiBaseUrl}/verify/collection-inscription/verify/${inscriptionId}/${collectionId}`,
      {
        headers: getAuthHeaders()
      }
    );
    return response.data;
  },

  /**
   * Start the inscription process for a collection
   * @param collectionId Collection ID
   * @param requesterDid Requester DID
   * @param options Additional options
   * @returns Response with inscription data
   */
  async startCollectionInscription(
    collectionId: string, 
    requesterDid: string,
    options?: {
      feeRate?: number;
      useBatching?: boolean;
      batchSize?: number;
    }
  ): Promise<CollectionInscriptionResponse> {
    const response = await fetchClient.post(
      `${apiBaseUrl}/verify/collection-inscription/start`,
      {
        collectionId,
        requesterDid,
        ...options
      },
      {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  },

  /**
   * Get the status of a collection inscription
   * @param inscriptionId Inscription ID
   * @returns Response with inscription status
   */
  async getCollectionInscriptionStatus(inscriptionId: string): Promise<CollectionInscriptionStatusResponse> {
    const response = await fetchClient.get(
      `${apiBaseUrl}/verify/collection-inscription/${inscriptionId}`,
      {
        headers: getAuthHeaders()
      }
    );
    return response.data;
  },

  /**
   * Get inscriptions for a collection
   * @param collectionId Collection ID
   * @returns Response with inscriptions data
   */
  async getCollectionInscriptions(collectionId: string): Promise<any> {
    const response = await fetchClient.get(
      `${apiBaseUrl}/verify/collection-inscriptions/collection/${collectionId}`,
      {
        headers: getAuthHeaders()
      }
    );
    return response.data;
  },

  /**
   * Cancel an in-progress inscription
   * @param inscriptionId Inscription ID
   * @param requesterDid Requester DID
   * @returns Response with cancellation status
   */
  async cancelCollectionInscription(inscriptionId: string, requesterDid: string): Promise<any> {
    const response = await fetchClient.post(
      `${apiBaseUrl}/verification/collections/inscriptions/${inscriptionId}/cancel`,
      { requesterDid },
      {
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  },

  /**
   * Inscribe a collection on-chain
   * This is a convenience method that starts the inscription process and waits for completion
   * @param collectionId Collection ID
   * @param requesterDid Requester DID
   * @param options Additional options
   * @returns The inscription ID when completed
   */
  async inscribeCollection(
    collectionId: string,
    requesterDid: string,
    options?: {
      feeRate?: number;
      useBatching?: boolean;
      batchSize?: number;
      pollingIntervalMs?: number;
      timeoutMs?: number;
    }
  ): Promise<string> {
    // Default options
    const {
      pollingIntervalMs = 2000,
      timeoutMs = 120000, // 2 minutes timeout
      ...inscriptionOptions
    } = options || {};

    // Start the inscription process
    const startResponse = await this.startCollectionInscription(
      collectionId,
      requesterDid,
      inscriptionOptions
    );

    if (startResponse.status !== 'success' || !startResponse.data?.inscriptionId) {
      throw new Error(startResponse.message || 'Failed to start collection inscription');
    }

    const inscriptionId = startResponse.data.inscriptionId;
    const startTime = Date.now();

    // Poll for completion
    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const statusResponse = await this.getCollectionInscriptionStatus(inscriptionId);
          
          if (statusResponse.status !== 'success') {
            reject(new Error(statusResponse.data?.inscription?.error || 'Failed to get inscription status'));
            return;
          }

          const inscriptionStatus = statusResponse.data?.inscription?.status;
          
          // Check if completed
          if (inscriptionStatus === 'completed' && statusResponse.data?.inscription?.inscriptionId) {
            resolve(statusResponse.data.inscription.inscriptionId);
            return;
          }
          
          // Check if failed
          if (inscriptionStatus === 'failed') {
            reject(new Error(statusResponse.data?.inscription?.error || 'Inscription failed'));
            return;
          }
          
          // Check timeout
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error('Inscription timed out'));
            return;
          }
          
          // Continue polling
          setTimeout(checkStatus, pollingIntervalMs);
        } catch (error) {
          reject(error);
        }
      };
      
      // Start polling
      setTimeout(checkStatus, pollingIntervalMs);
    });
  }
};
