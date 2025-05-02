import { LinkedResource, Utxo } from 'ordinalsplus';
// Import types from the local types/index file
import type { 
    ApiResponse,
    GenericInscriptionRequest,
    DidInscriptionRequest,
    ResourceInscriptionRequest,
    PsbtResponse,
    FeeEstimateResponse,
    TransactionStatusResponse,
    InscriptionDetailsResponse,
    NetworkInfo,
} from '../types/index';

// Define Request and Response types for Commit PSBT endpoint
// Mirroring the backend schema definition
interface CreateCommitRequest {
  network: string;
  contentType: string;
  contentBase64: string;
  feeRate: number;
  recipientAddress: string;
  changeAddress: string;
  utxos: Utxo[]; // Use Utxo directly
  parentDid?: string;
  metadata?: Record<string, any>; 
}

// Export the interface
export interface CreateCommitResponse {
  commitPsbtBase64: string;
  unsignedRevealPsbtBase64: string;
  revealSignerWif: string;
  commitTxOutputValue: number;
  revealFee: number;
  leafScriptHex?: string; 
}

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
   * Get the base URL configuration
   */
  getConfig(): { baseUrl: string } {
    return { baseUrl: this.baseUrl };
  }

  /**
   * Fetches the list of supported networks from the backend.
   */
  async getNetworks(): Promise<NetworkInfo[]> {
    try {
      // This endpoint should NOT include network= parameter
      const response = await fetch(`${this.baseUrl}/api/networks`);
      return await handleApiResponse<NetworkInfo[]>(response);
    } catch (error) {
      console.error('Error fetching networks:', error);
      // Return empty array or re-throw depending on desired error handling
      return [];
    }
  }

  /**
   * Checks the status of the backend API.
   */
  async checkApiStatus(): Promise<boolean> {
    try {
      // This endpoint likely doesn't need network param either
      const response = await fetch(`${this.baseUrl}/api/status`); // Assuming a /api/status endpoint
      return response.ok;
    } catch (error) {
      console.error('Error checking API status:', error);
      return false;
    }
  }

  // --- Network Specific Methods ---
  // All methods below now accept networkType as the first argument

  private buildUrl(path: string, networkType: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    url.searchParams.append('network', networkType);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value);
        }
      });
    }
    return url.toString();
  }

  /**
   * Fetch resources by DID for a specific network
   */
  async fetchResourcesByDid(networkType: string, did: string): Promise<ApiResponse> { // Changed return type, likely needs adjustment based on actual API
    const url = this.buildUrl(`/api/resources/did/${encodeURIComponent(did)}`, networkType);
    console.log(`[ApiService] Fetching resources by DID: ${url}`);
    const response = await fetch(url);
    // Assuming ApiResponse is the correct wrapper type from your backend
    return await handleApiResponse<ApiResponse>(response);
  }

  /**
   * Fetch resource content for a specific network
   */
  async fetchResourceContent(networkType: string, identifier: string): Promise<LinkedResource> {
    const url = this.buildUrl(`/api/content/${encodeURIComponent(identifier)}`, networkType);
    console.log(`[ApiService] Fetching resource content: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<LinkedResource>(response);
  }

  /**
   * Fetch explorer data (general list of resources/inscriptions) with pagination for a specific network.
   * Renamed from exploreBtcoDids.
   */
  async fetchExplorerData(networkType: string, page = 1, limit = 50): Promise<ApiResponse> {
    const params = { page: String(page), limit: String(limit) };
    // Assuming a general explorer endpoint, adjust path if needed
    const url = this.buildUrl(`/api/explore`, networkType, params);
    console.log(`[ApiService] Fetching explorer data: ${url}`);
    const response = await fetch(url);
    // Assuming ApiResponse contains linkedResources, page, totalItems etc.
    return await handleApiResponse<ApiResponse>(response);
  }


  /**
   * Create a new linked resource associated with a DID on a specific network
   */
  async createLinkedResource(
    networkType: string,
    resourceData: {
      inscriptionId: string;
      type: string;
      contentType: string;
      content: Record<string, unknown>;
      didReference?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<LinkedResource> {
    // Ensure inscriptionId is present
    if (!resourceData.inscriptionId) {
      throw new Error('Inscription ID is required for resource creation');
    }

    // Prepare the request data
    const requestData = {
      ...resourceData,
      type: resourceData.type || 'resource',
      contentType: resourceData.contentType || 'application/json',
      content: resourceData.content || {},
      ...(resourceData.didReference && { didReference: resourceData.didReference }),
      ...(resourceData.metadata && { metadata: resourceData.metadata })
    };

    // POST request, add network to URL params
    const url = this.buildUrl(`/api/resources`, networkType);
    console.log(`[ApiService] Creating linked resource at: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });

    return await handleApiResponse<LinkedResource>(response);
  }

  /**
   * Retrieve a linked resource by its DID on a specific network
   */
  async getResourceByDid(networkType: string, didId: string): Promise<LinkedResource> {
    const url = this.buildUrl(`/api/resources/${encodeURIComponent(didId)}`, networkType);
    console.log(`[ApiService] Getting resource by DID: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<LinkedResource>(response);
  }

  /**
   * Fetches all resources with optional pagination for a specific network
   * Updated to use /api/inscriptions endpoint.
   */
  async fetchAllResources(networkType: string, page = 1, limit = 20, contentType?: string | null): Promise<ApiResponse> {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
    };
    if (contentType) {
      params['contentType'] = contentType;
    }
    // Change path back to /api/resources
    const url = this.buildUrl(`/api/resources`, networkType, params);
    console.log(`[ApiService] Fetching all resources from: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<ApiResponse>(response);
  }

  /**
   * Fetches a resource by its ID (e.g., inscription ID or database ID) on a specific network
   */
  async fetchResourceById(networkType: string, id: string): Promise<ApiResponse> { // Adjust return type if needed
    const url = this.buildUrl(`/api/resource/${encodeURIComponent(id)}`, networkType); // Assuming path /api/resource/:id
    console.log(`[ApiService] Fetching resource by ID: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<ApiResponse>(response);
  }


  /**
   * Get Fee Estimates for a specific network
   */
  async getFeeEstimates(networkType: string): Promise<FeeEstimateResponse> {
    const url = this.buildUrl('/api/fees', networkType); 
    console.log(`[ApiService] Getting fee estimates: ${url}`);
    const response = await fetch(url);
    const data = await response.json(); 
    if (!response.ok) {
      throw new Error(`API error ${response.status}: ${data?.error || 'Failed to fetch fees'}`);
    }
    if (typeof data?.low !== 'number' || typeof data?.medium !== 'number' || typeof data?.high !== 'number') {
        console.error('[ApiService] Invalid fee response structure:', data);
        throw new Error('Invalid fee estimate data received from API');
    }
    return data as FeeEstimateResponse;
  }

  // Common handler for inscription creation
  private async createInscription<T extends GenericInscriptionRequest | DidInscriptionRequest | ResourceInscriptionRequest>(
    networkType: string,
    endpoint: string,
    request: T
  ): Promise<PsbtResponse> {
    const url = this.buildUrl(endpoint, networkType);
    console.log(`[ApiService] Creating inscription at: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    return handleApiResponse<PsbtResponse>(response);
  }


  /**
   * Create a Generic Inscription PSBT for a specific network
   */
  async createGenericInscription(networkType: string, request: GenericInscriptionRequest): Promise<PsbtResponse> {
    // Assuming endpoint /api/inscriptions/generic
    return this.createInscription(networkType, '/api/inscriptions/generic', request);
  }

  /**
   * Create a DID Inscription PSBT for a specific network
   */
  async createDidInscription(networkType: string, request: DidInscriptionRequest): Promise<PsbtResponse> {
     // Assuming endpoint /api/inscriptions/did
    return this.createInscription(networkType, '/api/inscriptions/did', request);
  }

  /**
   * Create a Resource Inscription PSBT for a specific network
   */
  async createResourceInscription(networkType: string, request: ResourceInscriptionRequest): Promise<PsbtResponse> {
     // Assuming endpoint /api/inscriptions/resource
    return this.createInscription(networkType, '/api/inscriptions/resource', request);
  }


  /**
   * Get Transaction Status for a specific network
   */
  async getTransactionStatus(networkType: string, txid: string): Promise<TransactionStatusResponse> {
    const url = this.buildUrl(`/api/transactions/${txid}/status`, networkType); // Assuming path
    console.log(`[ApiService] Getting transaction status: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<TransactionStatusResponse>(response);
  }


  /**
    * Retrieve a resource by its identifier (could be inscription ID, etc.) on a specific network
    * Note: This might overlap with fetchResourceById. Consolidate if possible based on backend API design.
    * Kept original signature for now.
    */
  async getResourceById(networkType: string, id: string): Promise<any> { // Return type might need refinement
    const url = this.buildUrl(`/api/resource/${encodeURIComponent(id)}`, networkType); // Assuming path /api/resource/:id
    console.log(`[ApiService] Getting resource by ID (getResourceById): ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<any>(response); // Use specific type if known
  }

  /**
   * Get Inscription Details for a specific network
   */
  async getInscriptionDetails(networkType: string, inscriptionId: string): Promise<InscriptionDetailsResponse> {
    const url = this.buildUrl(`/api/inscriptions/${inscriptionId}`, networkType); // Assuming path
    console.log(`[ApiService] Getting inscription details: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<InscriptionDetailsResponse>(response);
  }


  /**
   * Get Resources Linked to a DID for a specific network
   */
  async getLinkedResources(networkType: string, did: string): Promise<LinkedResource[]> {
    // Assuming the backend returns the array directly under 'data' key or similar
    const url = this.buildUrl(`/api/dids/${encodeURIComponent(did)}/resources`, networkType); // Assuming path
    console.log(`[ApiService] Getting linked resources: ${url}`);
    const response = await fetch(url);
    // Adjust if the backend returns a different structure (e.g., { data: LinkedResource[] })
    return await handleApiResponse<LinkedResource[]>(response);
  }

  /**
   * Prepare inscription details (script, fee) - May or may not need network depending on backend logic
   * Keeping networkType parameter for consistency, remove if backend doesn't need it.
   */
  async prepareInscription(networkType: string, request: {
    contentType: string;
    content: string;
    feeRate: number;
  }): Promise<{ inscriptionScript: string; estimatedFee: number }> {
     // Assuming endpoint /api/inscriptions/prepare
    const url = this.buildUrl('/api/inscriptions/prepare', networkType);
    console.log(`[ApiService] Preparing inscription: ${url}`);
    const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(request)
    });
    return await handleApiResponse<{ inscriptionScript: string; estimatedFee: number }>(response);
  }


  /**
   * Fetches UTXOs for an address on a specific network
   */
  async getAddressUtxos(networkType: string, address: string): Promise<Utxo[]> {
    const url = this.buildUrl(`/api/addresses/${address}/utxos`, networkType); 
    console.log(`[ApiService] Getting address UTXOs: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<Utxo[]>(response);
  }

  // --- NEW Method for Commit PSBT ---
  async createCommitPsbt(request: CreateCommitRequest): Promise<CreateCommitResponse> {
      const path = '/api/inscriptions/commit';
      // Network is in the body, not query params for this POST request
      const url = `${this.baseUrl}${path}`;
      console.log(`[ApiService] Creating commit PSBT at: ${url}`);
      
      const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
      });
      
      // Use a modified handler or inline logic as response isn't wrapped in { data: ... }
      const data = await response.json();
      if (!response.ok) {
          throw new Error(`API error ${response.status}: ${data?.error || 'Failed to create commit PSBT'}`);
      }
      // Validate expected fields (remove leafScriptHex check)
      if (
        typeof data?.commitPsbtBase64 !== 'string' ||
        typeof data?.unsignedRevealPsbtBase64 !== 'string' ||
        typeof data?.revealSignerWif !== 'string' ||
        typeof data?.commitTxOutputValue !== 'number' ||
        typeof data?.revealFee !== 'number' 
      ) {
        console.error('[ApiService] Invalid commit response structure:', data);
        throw new Error('Invalid commit PSBT data received from API');
      }
      return data as CreateCommitResponse;
  }
  // --- End NEW Method ---

  /**
   * Broadcast a transaction to a specific network
   * Updated to accept network in body
   */
  async broadcastTransaction(networkType: string, txHex: string): Promise<{ txid: string }> {
    const path = '/api/transactions/broadcast';
    const url = `${this.baseUrl}${path}`;
    console.log(`[ApiService] Broadcasting transaction: ${url}`);
    const response = await fetch(url, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        // Send network in body as per backend update
        body: JSON.stringify({ txHex, network: networkType })
    });
    // Use modified handler or inline logic as response is { status: 'success', txid: ... }
    const data = await response.json();
    if (!response.ok || data.status === 'error') {
        throw new Error(`API error ${response.status}: ${data?.error || data?.message || 'Failed to broadcast transaction'}`);
    }
    if (typeof data?.txid !== 'string') {
        console.error('[ApiService] Invalid broadcast response structure:', data);
        throw new Error('Invalid broadcast response data received from API');
    }
    return { txid: data.txid };
  }
}

export default ApiService; 