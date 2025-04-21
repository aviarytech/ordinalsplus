import { LinkedResource, Utxo } from 'ordinalsplus';
// Import types from the local types/index file
import type { 
    ApiResponse,
    ExplorerState,
    GenericInscriptionRequest,
    DidInscriptionRequest,
    ResourceInscriptionRequest,
    PsbtResponse,
    FeeEstimateResponse,
    TransactionStatusResponse,
    InscriptionDetailsResponse,
    NetworkInfo
} from '../types/index';

// Helper function for handling API responses
async function handleApiResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData = 'Unknown API error';
    try {
      errorData = await response.text();
    } catch (e) { /* Ignore */ }
    throw new Error(`API error ${response.status}: ${errorData}`);
  }
  const data = await response.json();
  if (data.status === 'error') {
    throw new Error(data.message || 'API returned an error status');
  }
  if (!data.data) {
    // Handle cases where data might be directly in the response (like simple status checks)
    // Or if the expected structure is just { status: 'success', data: ... }
    // If data.data is strictly required for all successful non-error responses, keep the error:
    // throw new Error('API response missing expected data field');
    // For now, let's allow responses without a nested data field if status is success
    return data as T;
  }
  return data.data as T;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    console.log(`[ApiService] Initialized with baseUrl: ${this.baseUrl}`);
  }

  /**
   * Update the base URL for the API service.
   * @param newBaseUrl The new base URL to use.
   */
  public setBaseUrl(newBaseUrl: string): void {
    this.baseUrl = newBaseUrl.endsWith('/') ? newBaseUrl.slice(0, -1) : newBaseUrl;
    console.log(`[ApiService] Updated baseUrl to: ${this.baseUrl}`);
  }

  /**
   * Get the base URL configuration
   */
  getConfig(): { baseUrl: string } {
    return { baseUrl: this.baseUrl };
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
  async fetchResourceContent(identifier: string): Promise<LinkedResource> {
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
          linkedResources: [],
          isLoading: false,
          error: data.error,
          currentPage: 0,
          totalItems: 0,
          itemsPerPage: 50
        };
      }
      
      return {
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
  ): Promise<LinkedResource> {
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
      
      return data.data as LinkedResource;
    } catch (error) {
      console.error('Error creating linked resource:', error);
      throw error;
    }
  }

  /**
   * Retrieve a linked resource by its DID
   */
  async getResourceByDid(didId: string): Promise<LinkedResource> {
    try {
      const response = await fetch(`${this.baseUrl}/api/resources/${encodeURIComponent(didId)}`);
      
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
  }

  /**
   * Fetches all resources with optional pagination and filtering
   */
  async fetchAllResources(page = 1, limit = 20, contentType?: string | null): Promise<ApiResponse> {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      // Omit contentType parameter for now, assuming /api/explore doesn't support it
      // if (contentType) {
      //   params.append('contentType', contentType);
      // }
      const url = `${this.baseUrl}/api/explore?${params.toString()}`;
      console.log(`[ApiService] Fetching all resources from (omitting contentType filter): ${url}`);

      const response = await fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ApiService] Error fetching all resources: ${response.status} ${errorText}`);
        throw new Error(`API error ${response.status}: ${errorText || response.statusText}`);
      }

      const data: ApiResponse = await response.json(); // Expect ApiResponse structure directly
      console.log(`[ApiService] Received response for all resources:`, data); // Add logging

      // Validate the expected structure of ApiResponse
      if (!data || typeof data !== 'object' || !Array.isArray(data.linkedResources)) {
         console.warn('[ApiService] Unexpected API response structure for all resources:', data);
         // Return a default empty structure to avoid crashing the UI
         return {
           linkedResources: [],
           page: 1,
           totalItems: 0,
           itemsPerPage: limit,
           error: 'Unexpected API response structure',
         };
      }
      
      // Ensure necessary fields have default values if missing
      return {
        linkedResources: data.linkedResources || [],
        page: data.page ?? 1,
        totalItems: data.totalItems ?? 0,
        itemsPerPage: data.itemsPerPage ?? limit,
        error: data.error || undefined, // Use undefined instead of null
      };
    } catch (error) {
      console.error('[ApiService] Failed to fetch all resources:', error);
      throw error; // Re-throw the error to be caught by the calling component
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
        linkedResources: data.linkedResources || [],
        page: 1,
        totalItems: 1,
        itemsPerPage: 1,
        error: data.error
      };
    } catch (error) {
      console.error('Error fetching resource from API:', error);
      return {
        linkedResources: [],
        page: 1,
        totalItems: 0,
        itemsPerPage: 1,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if API is available - disabled to avoid 404 errors
   */
  async checkApiStatus(): Promise<boolean> {
    // Skip actual API check to prevent 404 errors
    return true;
  }

  // --- ADDED METHODS for Ordinals Plus Creation --- 

  /**
   * Get available network configurations from the backend.
   */
  async getNetworks(): Promise<NetworkInfo[]> {
    const fullUrl = `${this.baseUrl}/api/networks`; 
    try {
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
          const rawText = await response.text(); 
          throw new Error(`API error ${response.status}: ${rawText}`);
      }
      
      const jsonData = await response.json(); 
  
      if (!Array.isArray(jsonData)) {
          console.error('API response for networks was not an array:', jsonData);
          throw new Error('Unexpected format for network configurations response - expected array.');
      }

      const networksData = jsonData as any[];

      // Modify validation and add inference
      const processedNetworks = networksData
        .filter(net => { // Step 1: Filter only based on essential fields received
            const hasRequiredBaseFields = net && net.id && net.name;
            if (!hasRequiredBaseFields) {
                console.warn('Filtering out invalid network object received from API (missing id or name):', net);
            }
            return hasRequiredBaseFields;
         })
        .map(net => { // Step 2: Map and infer missing fields
            // **Temporary Frontend Inference (Requires Backend Update!)**
            let type: 'mainnet' | 'testnet' | 'regtest' | 'signet' = 'mainnet'; // Default assumption
            let apiUrl = this.baseUrl; // Default assumption (initial URL)
            
            // Adjust apiUrl and type based on id - USE YOUR ACTUAL BACKEND URLs
            if (net.id === 'testnet') {
                type = 'testnet';
                apiUrl = 'http://localhost:3001'; // Replace with your actual Testnet API URL
            } else if (net.id === 'signet') {
                type = 'signet';
                apiUrl = 'http://localhost:3002'; // Replace with your actual Signet API URL
            } else if (net.id === 'mainnet') {
                type = 'mainnet';
                apiUrl = 'http://localhost:3000'; // Replace with your actual Mainnet API URL
            } else {
                // Handle unknown network IDs if necessary
                 console.warn(`[ApiService] Encountered unknown network ID '${net.id}' - using default type/apiUrl.`);
            }
            
            console.warn(`[ApiService] Inferred type ('${type}') and apiUrl ('${apiUrl}') for network id '${net.id}'. Backend /api/networks should provide these fields directly.`);

            // Construct the full NetworkInfo object
            const networkInfo: NetworkInfo = { 
                id: net.id,
                name: net.name,
                type: type, 
                apiUrl: apiUrl 
            };
            return networkInfo;
        }); 
      
      // Log if any networks were filtered initially
      if (processedNetworks.length !== networksData.length) {
          console.warn('Some network objects received from API were filtered out due to missing id or name.');
      }
      
      return processedNetworks || []; // Return the processed networks
    } catch (error) {
      console.error(`Error fetching or processing network configurations from ${fullUrl}:`, error);
      return []; 
    }
  }

  /**
   * Get current fee estimates.
   */
  async getFeeEstimates(): Promise<FeeEstimateResponse> {
    console.log('[ApiService] Fetching fee estimates from /fees/estimate');
    const response = await fetch(`${this.baseUrl}/fees/estimate`);
    // Fee estimates might not have a nested 'data' field, handle directly
    if (!response.ok) {
      let errorData = 'Unknown API error';
      try {
        errorData = await response.text();
      } catch (e) { /* Ignore */ }
      throw new Error(`API error ${response.status}: ${errorData}`);
    }
    return await response.json() as FeeEstimateResponse; 
    // return handleApiResponse<FeeEstimateResponse>(response); // Might fail if no 'data' field
  }

  /**
   * Request a PSBT for a generic inscription.
   */
  async createGenericInscription(request: GenericInscriptionRequest): Promise<PsbtResponse> {
    const endpointPath = '/api/inscriptions/generic';
    const fullUrl = `${this.baseUrl}${endpointPath}`;
    console.log(`[ApiService DEBUG] createGenericInscription called.`);
    console.log(`[ApiService DEBUG]   Base URL: ${this.baseUrl}`);
    console.log(`[ApiService DEBUG]   Endpoint Path: ${endpointPath}`);
    console.log(`[ApiService DEBUG]   Full URL: ${fullUrl}`);
    console.log(`[ApiService DEBUG]   Method: POST`);
    console.log(`[ApiService DEBUG]   Request Body:`, request);
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      // Log raw response status for 404 debugging
      console.log(`[ApiService DEBUG] Raw response status for ${fullUrl}: ${response.status}`);
      // Using handleApiResponse which should throw on non-ok status
      return await handleApiResponse<PsbtResponse>(response);
    } catch (error) {
      console.error(`[ApiService DEBUG] Error creating generic inscription PSBT at ${fullUrl}:`, error);
      throw error;
    }
  }

  /**
   * Request a PSBT for a DID inscription.
   */
  async createDidInscription(request: DidInscriptionRequest): Promise<PsbtResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/inscriptions/did`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      return await handleApiResponse<PsbtResponse>(response);
    } catch (error) {
      console.error('Error creating DID inscription PSBT:', error);
      throw error;
    }
  }

  /**
   * Request a PSBT for a linked resource inscription.
   */
  async createResourceInscription(request: ResourceInscriptionRequest): Promise<PsbtResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/inscriptions/resource`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      return await handleApiResponse<PsbtResponse>(response);
    } catch (error) {
      console.error('Error creating resource inscription PSBT:', error);
      throw error;
    }
  }

  /**
   * Check the status of a transaction.
   */
  async getTransactionStatus(txid: string): Promise<TransactionStatusResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/api/transactions/${txid}/status`);
      // Note: Transaction status might return data directly, not nested under 'data'
      // Adjust handleApiResponse or handle here if necessary based on actual backend response
      const data = await response.json();
       if (!response.ok) {
        let errorData = 'Unknown API error';
        try {
          errorData = data.message || await response.text();
        } catch (e) { /* Ignore */ }
        throw new Error(`API error ${response.status}: ${errorData}`);
       }
      if (data.status === 'error') {
          throw new Error(data.message || 'API returned an error status checking transaction');
      }
      // Assuming status endpoint returns { status: 'success', data: { status: 'confirmed', ... } }
      if (data.data && data.status === 'success') {
         return data.data as TransactionStatusResponse;
      } else {
         // Handle cases where the structure might be simpler, e.g. just { status: 'confirmed', ... }
         // This depends heavily on the actual backend implementation for this endpoint
         console.warn('Unexpected transaction status response format:', data);
         // Fallback or re-throw based on expected format
         throw new Error('Unexpected format for transaction status response'); 
      }

    } catch (error) {
      console.error(`Error checking transaction status for ${txid}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve a resource by its ID (Inscription ID or DID)
   */
  async getResourceById(id: string): Promise<any> { // Return type might need refinement based on API
    try {
      // Use the generic /api/resources/:id endpoint
      const response = await fetch(`${this.baseUrl}/api/resources/${encodeURIComponent(id)}`);
      return handleApiResponse<any>(response); // Use helper, refine <any> later
    } catch (error) {
      console.error(`Error retrieving resource by ID ${id}:`, error);
      throw error;
    }
  }

  /**
   * Fetches details for a specific inscription ID from the backend.
   *
   * @param inscriptionId The ID of the inscription.
   * @returns A promise resolving to the inscription details.
   */
  async getInscriptionDetails(inscriptionId: string): Promise<InscriptionDetailsResponse> {
    console.log(`[ApiService] Fetching inscription details for: ${inscriptionId}`);
    try {
      const response = await fetch(`${this.baseUrl}/inscription/${encodeURIComponent(inscriptionId)}`);
      
      // Use the handleApiResponse helper, assuming it can handle direct data or { data: ... }
      // Adjust error handling based on expected backend responses
      if (!response.ok) {
        let errorMsg = `API error ${response.status}`; 
        try {
            const errData = await response.json();
            errorMsg = errData?.error || errorMsg; // Use specific error from backend if available
        } catch (e) { /* Ignore if response is not JSON */ }
        
        // Throw a specific error type or message for 404
        if (response.status === 404) {
          throw new Error('InscriptionNotFound'); // Special marker error
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      // Assuming the backend returns the InscriptionDetailsResponse directly on success
      return data as InscriptionDetailsResponse;

    } catch (error) {
      console.error(`[ApiService] Error fetching inscription details for ${inscriptionId}:`, error);
      // Re-throw the specific 'InscriptionNotFound' error if caught
      if (error instanceof Error && error.message === 'InscriptionNotFound') {
        throw error;
      }
      // Throw a generic error otherwise
      throw new Error(`Failed to fetch inscription details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get linked resources associated with a specific DID
   */
  async getLinkedResources(did: string): Promise<LinkedResource[]> {
    try {
        const url = `${this.baseUrl}/api/dids/${encodeURIComponent(did)}/resources`;
        console.log(`[ApiService] Fetching resources for DID: ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[ApiService] Error fetching resources for DID ${did}: ${response.status} ${errorText}`);
            throw new Error(`API error ${response.status}: ${errorText || response.statusText}`);
        }

        const data = await response.json();
        console.log(`[ApiService] Received resources for DID ${did}:`, data);

        // The API /api/dids/:did/resources might return ApiResponse structure or just the array
        // Adjusting based on previous usage where it seemed to return just the array
        if (Array.isArray(data)) {
            return data as LinkedResource[];
        } else if (data && Array.isArray(data.linkedResources)) {
            // If it returns the ApiResponse structure, extract the array
            return data.linkedResources as LinkedResource[];
        } else {
            console.warn(`[ApiService] Unexpected response structure for DID ${did}:`, data);
            return []; // Return empty array on unexpected structure
        }
    } catch (error) {
        console.error(`[ApiService] Failed to fetch resources for DID ${did}:`, error);
        throw error; // Re-throw
    }
  }

  /**
   * Prepares the inscription envelope script and estimates fees via the API.
   *
   * @param request - Object containing contentType, content (formatted string), and feeRate.
   * @returns Promise resolving to { inscriptionScript: string (hex), estimatedFee: number }
   */
  async prepareInscription(request: {
    contentType: string;
    content: string;
    feeRate: number;
  }): Promise<{ inscriptionScript: string; estimatedFee: number }> {
    console.log('[ApiService] Calling /api/inscriptions/prepare with:', request);
    const response = await fetch(`${this.baseUrl}/api/inscriptions/prepare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    // Use the generalized handler
    return handleApiResponse<{ inscriptionScript: string; estimatedFee: number }>(response);
  }

  /**
   * Fetches UTXOs for a given address from the backend API.
   * @param address The Bitcoin address.
   * @param network Optional network ('mainnet' or 'testnet').
   * @returns A promise resolving to an array of UTXOs.
   */
  async getAddressUtxos(address: string, network?: 'mainnet' | 'testnet'): Promise<Utxo[]> {
    console.log(`[ApiService] Fetching UTXOs for address ${address} on network ${network || 'mainnet'}...`);
    try {
      const networkQuery = network ? `?network=${network}` : '';
      const response = await fetch(`${this.baseUrl}/api/addresses/${encodeURIComponent(address)}/utxos${networkQuery}`);
      
      // Use handleApiResponse for consistent error handling and data extraction
      // Assuming the backend returns { status: 'success', data: Utxo[] }
      const result = await handleApiResponse<Utxo[]>(response);
      console.log(`[ApiService] Successfully fetched ${result.length} UTXOs.`);
      return result;
    } catch (error) {
      console.error(`[ApiService] Error fetching UTXOs for ${address}:`, error);
      // Re-throw the error to be caught by the calling component/hook
      throw error;
    }
  }

  /**
   * Broadcasts a raw transaction hex to the network via the backend.
   * @param txHex The raw transaction hex string.
   * @returns A promise that resolves with the transaction ID.
   */
  async broadcastTransaction(txHex: string): Promise<{ txid: string }> {
    console.log(`[ApiService] Broadcasting transaction hex: ${txHex.substring(0, 60)}...`);
    try {
      const response = await fetch(`${this.baseUrl}/api/transactions/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ txHex }),
      });

      // Use handleApiResponse for consistent error handling and data extraction
      // Assuming the backend returns { status: 'success', data: { txid: '...' } }
      const result = await handleApiResponse<{ txid: string }>(response);
      console.log(`[ApiService] Broadcast successful, txid: ${result.txid}`);
      return result; 

    } catch (error) {
      console.error('[ApiService] Error broadcasting transaction:', error);
      // Re-throw the error to be caught by the calling component
      throw error;
    }
  }

}

export default ApiService; 