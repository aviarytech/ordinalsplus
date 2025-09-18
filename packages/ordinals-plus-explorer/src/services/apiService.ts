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
   * Get a resource inscription by its ID
   */
  async getResourceInscription(id: string): Promise<any> {
    const url = `${this.baseUrl}/api/resource-inscriptions/${encodeURIComponent(id)}`;
    const response = await fetch(url);
    return await handleApiResponse<any>(response);
  }

  async prepareResourceInscription(id: string, network: string, recipientAddress: string, feeRate?: number): Promise<any> {
    const url = `${this.baseUrl}/api/resource-inscriptions/${encodeURIComponent(id)}/prepare?network=${encodeURIComponent(network)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recipientAddress, ...(feeRate ? { feeRate } : {}) })
    });
    return await handleApiResponse<any>(response);
  }

  async acceptCommitForResourceInscription(id: string, commitTxid: string): Promise<any> {
    const url = `${this.baseUrl}/api/resource-inscriptions/${encodeURIComponent(id)}/commit`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitTxid })
    });
    return await handleApiResponse<any>(response);
  }

  async finalizeRevealForResourceInscription(id: string, revealTxid: string): Promise<any> {
    const url = `${this.baseUrl}/api/resource-inscriptions/${encodeURIComponent(id)}/reveal`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revealTxid })
    });
    return await handleApiResponse<any>(response);
  }

  /**
   * Start a batch of resource inscriptions
   */
  async startBatchResourceInscriptions(networkType: string, requests: Array<{
    parentDid: string;
    requesterDid: string;
    label: string;
    resourceType: string;
    file: { buffer: Uint8Array; type: string };
    feeRate?: number;
    metadata?: Record<string, any>;
  }>): Promise<{ items: any[]; count: number }> {
    const url = this.buildUrl('/api/resource-inscriptions/batch', networkType);
    console.log(`[ApiService] Starting batch resource inscriptions: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests })
    });
    return await handleApiResponse<{ items: any[]; count: number }>(response);
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

  private buildUrl(path: string, networkType?: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (networkType) {
      url.searchParams.append('network', networkType);
    }
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
    // Use the correct endpoint for resource inscriptions
    return this.createInscription(networkType, '/api/resource-inscriptions', request);
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
    const url = this.buildUrl(`/api/dids/${did}/resources`, networkType);
    console.log(`[ApiService] Getting linked resources: ${url}`);
    const response = await fetch(url);
    
    // The DID router returns: { status: 'success', data: { resources: [...], count: N } }
    // handleApiResponse returns data.data (the inner object) if it exists
    const result = await handleApiResponse<{
      resources?: LinkedResource[];
      count?: number;
    }>(response);
    
    console.log(`[ApiService] DID resources response:`, result);
    
    // Since handleApiResponse returns the inner data object, check for resources directly
    if (result.resources) {
      console.log(`[ApiService] Found ${result.resources.length} resources:`, result.resources);
      return result.resources;
    }
    
    // Fallback for unexpected response format
    console.warn('[ApiService] No resources found in response:', result);
    return [];
  }
  
  /**
   * Get Resources associated with a DID
   * This is a convenience method that uses the network from the context
   */
  async getResourcesByDid(didId: string): Promise<ApiResponse> {
    // Get the network from the context or use default
    const networkType = this.getNetworkFromContext() || 'mainnet';
    
    const url = this.buildUrl(`/api/resources/did/${encodeURIComponent(didId)}`, networkType);
    console.log(`[ApiService] Getting resources by DID: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<ApiResponse>(response);
  }
  
  /**
   * Resolve a DID to get its DID Document and all inscriptions
   */
  async resolveDid(didId: string): Promise<{
    didDocument: any;
    inscriptions?: Array<{
      inscriptionId: string;
      content: string;
      metadata: any;
      contentUrl?: string;
      isValidDid?: boolean;
      didDocument?: any;
      error?: string;
    }>;
    resolutionMetadata?: {
      contentType?: string;
      error?: string;
      message?: string;
      inscriptionId?: string;
      satNumber?: string;
      created?: string;
      deactivated?: boolean;
      network?: string;
      totalInscriptions?: number;
    };
    didDocumentMetadata?: {
      created?: string;
      updated?: string;
      deactivated?: boolean;
      inscriptionId?: string;
      network?: string;
    };
  }> {
    const networkType = this.getNetworkFromContext() || 'mainnet';
    const url = this.buildUrl(`/api/dids/${encodeURIComponent(didId)}/resolve`, networkType);
    console.log(`[ApiService] Resolving DID: ${url}`);
    const response = await fetch(url);
    return await handleApiResponse<{
      didDocument: any;
      inscriptions?: Array<{
        inscriptionId: string;
        content: string;
        metadata: any;
        contentUrl?: string;
        isValidDid?: boolean;
        didDocument?: any;
        error?: string;
      }>;
      resolutionMetadata?: {
        contentType?: string;
        error?: string;
        message?: string;
        inscriptionId?: string;
        satNumber?: string;
        created?: string;
        deactivated?: boolean;
        network?: string;
        totalInscriptions?: number;
      };
      didDocumentMetadata?: {
        created?: string;
        updated?: string;
        deactivated?: boolean;
        inscriptionId?: string;
        network?: string;
      };
    }>(response);
  }
  
  /**
   * Create a new resource linked to a DID
   */
  async createResource(resourceData: {
    content: string | ArrayBuffer;
    contentType: string;
    metadata: any;
    parentDid: string;
  }): Promise<{ resourceId: string }> {
    // Get the network from the context or use default
    const networkType = this.getNetworkFromContext() || 'mainnet';
    
    // Convert content to base64 if needed
    let contentBase64: string;
    if (typeof resourceData.content === 'string') {
      // If it's already a data URL, extract the base64 part
      if (resourceData.content.startsWith('data:')) {
        const base64Part = resourceData.content.split(',')[1];
        contentBase64 = base64Part || btoa(resourceData.content);
      } else {
        // Otherwise, encode as base64
        contentBase64 = btoa(resourceData.content);
      }
    } else {
      // Convert ArrayBuffer to base64
      contentBase64 = btoa(
        Array.from(new Uint8Array(resourceData.content))
          .map(byte => String.fromCharCode(byte))
          .join('')
      );
    }
    
    // Prepare request data
    const requestData = {
      contentType: resourceData.contentType,
      contentBase64,
      metadata: resourceData.metadata,
      parentDid: resourceData.parentDid
    };
    
    const url = this.buildUrl(`/api/resources`, networkType);
    console.log(`[ApiService] Creating resource: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestData)
    });
    
    return await handleApiResponse<{ resourceId: string }>(response);
  }
  
  /**
   * Helper method to get the current network from context
   * This should be implemented based on how network context is managed in the application
   */
  private getNetworkFromContext(): string | null {
    // Prefer the NetworkContext key, fall back to legacy key
    try {
      const ctxKey = localStorage.getItem('ordinalsplus_selected_network_id'); // e.g., 'signet' | 'mainnet' | 'testnet'
      if (ctxKey) return ctxKey;
      const legacyKey = localStorage.getItem('currentNetwork');
      if (legacyKey) return legacyKey;
      return 'mainnet';
    } catch (e) {
      console.warn('[ApiService] Could not get network from context:', e);
      return 'mainnet';
    }
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
  
  /**
   * Gets a DID for a wallet address
   * 
   * @param networkType - The network type (e.g., 'bitcoin', 'testnet')
   * @param address - The wallet address to get the DID for
   * @returns The DID information for the address
   */
  async getDidForAddress(networkType: string, address: string): Promise<{ did?: string; error?: string }> {
    try {
      // First try to get DIDs directly associated with this address
      const url = this.buildUrl(`/api/addresses/${address}/dids`, networkType);
      console.log(`[ApiService] Getting DIDs for address: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        // If the endpoint doesn't exist or returns an error, use a fallback approach
        // Try to get the first inscription owned by this address and check if it's a DID
        const inscriptionsUrl = this.buildUrl(`/api/addresses/${address}/inscriptions`, networkType);
        const inscriptionsResponse = await fetch(inscriptionsUrl);
        const inscriptions = await handleApiResponse<any[]>(inscriptionsResponse);
        
        // Check if any of the inscriptions are DIDs
        for (const inscription of inscriptions || []) {
          if (inscription.content?.startsWith('did:btco:')) {
            return { did: inscription.content };
          }
        }
        
        return { error: 'No DID found for this address' };
      }
      
      const dids = await handleApiResponse<string[]>(response);
      if (dids && dids.length > 0) {
        return { did: dids[0] }; // Return the first DID associated with this address
      }
      
      return { error: 'No DID found for this address' };
    } catch (error) {
      console.error('[ApiService] Error getting DID for address:', error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
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

  /**
   * Get satoshi number for a given UTXO
   */
  async getSatNumber(networkType: string, utxo: string): Promise<number> {
    const url = this.buildUrl(`/api/utxo/${encodeURIComponent(utxo)}/sat-number`, networkType);
    console.log(`[ApiService] Getting sat number: ${url}`);
    
    const response = await fetch(url);
    const result = await handleApiResponse<{ satNumber: number }>(response);
    return result.satNumber;
  }

  /**
   * Get inscriptions for an address (owner_output locations)
   */
  async getAddressInscriptions(networkType: string, address: string): Promise<Array<{ id: string; owner_output: string }>> {
    const url = this.buildUrl(`/api/addresses/${encodeURIComponent(address)}/inscriptions`, networkType);
    console.log(`[ApiService] Getting address inscriptions: ${url}`);
    const response = await fetch(url);
    const result = await handleApiResponse<Array<{ id: string; owner_output: string }>>(response);
    return result;
  }

  /**
   * Verify a credential using backend verification
   */
  async verifyCredential(credential: any): Promise<{
    status: string;
    message?: string;
    issuer?: any;
    verifiedAt?: Date;
  }> {
    const url = `${this.baseUrl}/api/verify/credential`;
    console.log(`[ApiService] Verifying credential: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential })
    });
    
    return await handleApiResponse<{
      status: string;
      message?: string;
      issuer?: any;
      verifiedAt?: Date;
    }>(response);
  }

  /**
   * Get issuer information for a DID
   */
  async getIssuerInfo(did: string): Promise<{
    status: string;
    message?: string;
    issuer: any;
  }> {
    const url = `${this.baseUrl}/api/verify/issuer/${encodeURIComponent(did)}`;
    console.log(`[ApiService] Getting issuer info: ${url}`);
    
    const response = await fetch(url);
    return await handleApiResponse<{
      status: string;
      message?: string;
      issuer: any;
    }>(response);
  }
}

export default ApiService; 