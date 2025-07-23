import ApiService from './apiService';
import { ApiServiceConfig } from './types';
import { NetworkInfo } from '../context/NetworkContext'; // Import NetworkInfo type
import { env } from '../config/envConfig';

// Define the API Provider types
export enum ApiProviderType {
  ORDISCAN = 'ORDISCAN',
  ORD_REG_TEST_NODE = 'ORD_REG_TEST_NODE'
}

// Define a base configuration structure
interface BaseConfig {
    baseUrl: string;
    timeout?: number;
    apiKey?: string;
}

// Define specific config types if needed
interface OrdiscanConfig extends BaseConfig {
    type: ApiProviderType.ORDISCAN; 
}

// Add other provider types if needed
interface OrdNodeConfig extends BaseConfig {
    type: ApiProviderType.ORD_REG_TEST_NODE;
}

// Union type for all possible configurations
export type ApiConfig = OrdiscanConfig | OrdNodeConfig; // Add more types as needed

// --- Basic Response Type Definitions (Refine as needed) ---
type PsbtResponse = { psbt: string; size: number };
type BroadcastResponse = { txid: string };
type TxStatusResponse = { confirmed: boolean; inscriptionId?: string };
type FeeEstimateResponse = { fastestFee: number; halfHourFee: number; hourFee: number; minimumFee: number };
// Define other types like DidDocument, LinkedResource, Inscription if not already available
// Example:
// interface Inscription { id: string; /* ... other fields */ }

/**
 * Provides API service instance for the backend
 */
class ApiServiceProvider {
  private static instance: ApiServiceProvider;
  private config: ApiConfig;

  private constructor() {
    // Default configuration - adjust as needed
    this.config = {
        type: ApiProviderType.ORDISCAN, // Default to Ordiscan or determine dynamically
        baseUrl: env.VITE_BACKEND_URL || 'http://localhost:3000', // Default URL
        timeout: 10000 // Increased timeout slightly
    };
    console.log('[ApiServiceProvider] Initialized with config:', this.config);
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ApiServiceProvider {
    if (!ApiServiceProvider.instance) {
      ApiServiceProvider.instance = new ApiServiceProvider();
    }
    return ApiServiceProvider.instance;
  }

  /**
   * Update the API service configuration
   */
  public updateConfig(newConfig: Partial<ApiConfig>): void {
    const oldBaseUrl = this.config.baseUrl;
    this.config = { ...this.config, ...newConfig };
    if (oldBaseUrl !== this.config.baseUrl) {
         console.log('[ApiServiceProvider] Config updated, Base URL changed to:', this.config.baseUrl);
         // Potentially clear cache or reset state if needed due to URL change
    }
  }

  /**
   * Get the current configuration
   */
  public getConfig(): ApiConfig {
    return this.config;
  }

  /**
   * Check if the API is available
   */
  public async checkApiStatus(): Promise<boolean> {
    try {
      // Assume a simple GET endpoint like /health or /ping
      await this.fetchApi<any>('/health'); 
      return true;
    } catch (error) {
      console.error('[ApiServiceProvider] API status check failed:', error);
      return false;
    }
  }

  /**
   * Internal helper for making fetch requests
   */
  private async fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    console.log(`[ApiServiceProvider] Fetching: ${options.method || 'GET'} ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout || 10000);

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                // Add potential API key header if needed: 
                // ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}),
                ...(options.headers || {})
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorBody = 'Unknown error';
            try {
                const errorData = await response.json();
                errorBody = errorData.message || JSON.stringify(errorData); 
            } catch (e) { 
                try { errorBody = await response.text(); } catch (e2) {/* Ignore */} 
            }
            console.error(`[ApiServiceProvider] API Error ${response.status} (${response.statusText}) for ${options.method || 'GET'} ${url}: ${errorBody}`);
            throw new Error(`API Error ${response.status}: ${errorBody}`);
        }

        // Handle cases where response might be empty (e.g., 204 No Content)
        if (response.status === 204) {
            return null as T; 
        }
        
        return await response.json() as T;
    } catch (error) {
         clearTimeout(timeoutId);
         if (error instanceof Error && error.name === 'AbortError') {
             console.error(`[ApiServiceProvider] Request timed out: ${options.method || 'GET'} ${url}`);
             throw new Error('Request timed out');
         }
         console.error(`[ApiServiceProvider] Fetch error for ${options.method || 'GET'} ${url}: ${error instanceof Error ? error.message : String(error)}`);
         throw error; // Re-throw the original error
    }
  }

  /**
   * Get available networks
   */
  public async getNetworks(): Promise<NetworkInfo[]> {
    // TODO: Implement actual API call to fetch network configurations
    // return this.fetchApi<NetworkInfo[]>('/networks');
    console.warn('[ApiServiceProvider] getNetworks: Using mock data.');
    // Mock data for now, ensure it matches the NetworkInfo interface
    return Promise.resolve([
        { id: 'mainnet', name: 'Bitcoin Mainnet', type: 'mainnet', apiUrl: 'http://localhost:3000' }, 
        { id: 'testnet', name: 'Bitcoin Testnet', type: 'testnet', apiUrl: 'http://localhost:3001' } // Example testnet API
    ]);
  }

  /**
   * Requests the backend to prepare a PSBT for a generic inscription.
   * @param contentType MIME type of the content.
   * @param content Actual content (string or base64 for binary).
   * @param feeRate Satoshis per virtual byte.
   * @returns Promise resolving to { psbt: string, size: number }.
   */
  public async createGenericOrdinalPsbt(contentType: string, content: string, feeRate: number): Promise<{ psbt: string, size: number }> {
    console.warn('[ApiServiceProvider] createGenericOrdinalPsbt: Using mock data.');
    // TODO: Replace with actual API call
    // const body = JSON.stringify({ contentType, content, feeRate });
    // return this.fetchApi<{ psbt: string, size: number }>('/inscriptions/generic/prepare', { method: 'POST', body });
    return Promise.resolve({ psbt: 'mock-psbt-hex-generic', size: 250 });
  }

  /**
   * Requests the backend to prepare a PSBT for DID creation.
   * @param feeRate Satoshis per virtual byte.
   * @returns Promise resolving to { psbt: string, size: number }.
   */
  public async createDidPsbt(feeRate: number): Promise<PsbtResponse> {
    // Linter might complain here temporarily
    const body = JSON.stringify({ feeRate });
    return this.fetchApi<PsbtResponse>('/inscriptions/did/prepare', { method: 'POST', body });
  }

  /**
   * Requests the backend to prepare a PSBT for linking a resource to a DID.
   * @param parentDid The DID to link the resource to.
   * @param contentType MIME type of the resource content.
   * @param content Actual content (string or base64 for binary).
   * @param feeRate Satoshis per virtual byte.
   * @returns Promise resolving to { psbt: string, size: number }.
   */
  public async createLinkedResourcePsbt(parentDid: string, contentType: string, content: string, feeRate: number): Promise<PsbtResponse> {
    console.warn('[ApiServiceProvider] createLinkedResourcePsbt: Using mock data.');
    // TODO: Replace with actual API call
    // const body = JSON.stringify({ parentDid, contentType, content, feeRate });
    // return this.fetchApi<{ psbt: string, size: number }>('/inscriptions/resource/prepare', { method: 'POST', body });
    return Promise.resolve({ psbt: 'mock-psbt-hex-resource', size: 300 });
  }

  /**
   * Requests the backend to broadcast a signed transaction.
   * @param signedPsbtHex The signed PSBT in hex format.
   * @returns Promise resolving to { txid: string }.
   */
  public async broadcastTransaction(signedPsbtHex: string): Promise<{ txid: string }> {
    console.warn('[ApiServiceProvider] broadcastTransaction: Using mock data.');
    // TODO: Replace with actual API call
    // const body = JSON.stringify({ psbt: signedPsbtHex });
    // return this.fetchApi<{ txid: string }>('/transactions/broadcast', { method: 'POST', body });
    return Promise.resolve({ txid: `mock-txid-${Date.now()}` });
  }

  /**
   * Checks the confirmation status of a transaction.
   * @param txid The transaction ID.
   * @returns Promise resolving to { confirmed: boolean, inscriptionId?: string }.
   */
  public async checkTransactionStatus(txid: string): Promise<{ confirmed: boolean, inscriptionId?: string }> {
    console.warn(`[ApiServiceProvider] checkTransactionStatus (${txid}): Using mock data - confirming after delay.`);
    // TODO: Replace with actual API call
    // return this.fetchApi<{ confirmed: boolean, inscriptionId?: string }>(`/transactions/${txid}/status`);
    // Mock confirmation after a short delay
    return new Promise(resolve => {
       setTimeout(() => {
            resolve({ confirmed: true, inscriptionId: `mock-inscription-${txid}` });
       }, 5000); // 5 second delay
    });
  }

  /**
   * Fetches inscriptions owned by a specific address.
   * @param address The owner's Bitcoin address.
   * @returns Promise resolving to an array of inscriptions (define type).
   */
  public async getInscriptionsByOwner(address: string): Promise<any[]> { // Define Inscription type
    console.warn(`[ApiServiceProvider] getInscriptionsByOwner (${address}): Using mock data.`);
    // TODO: Replace with actual API call
    // return this.fetchApi<any[]>(`/addresses/${address}/inscriptions`);
    return Promise.resolve([ 
        { id: 'mock-inscription-1', type: 'did' }, 
        { id: 'mock-inscription-2', type: 'resource' }
    ]);
  }

  // Get fee estimates (from backend)
  public async getFeeEstimates(): Promise<FeeEstimateResponse> {
    // Linter might complain here temporarily
    return this.fetchApi<FeeEstimateResponse>('/fees/recommended'); 
  }

  // Resolve DID
  public async resolveDid(did: string): Promise<any> { // TODO: Use specific DidDocument type
    return this.fetchApi<any>(`/dids/${encodeURIComponent(did)}`);
  }

  // Get linked resources
  public async getLinkedResources(did: string): Promise<any[]> { // TODO: Use specific LinkedResource type
    return this.fetchApi<any[]>(`/dids/${encodeURIComponent(did)}/resources`);
  }
  
  // Search resources
  public async searchResources(query: string): Promise<any[]> { // TODO: Use specific Resource type
    return this.fetchApi<any[]>(`/resources/search?q=${encodeURIComponent(query)}`);
  }

  // Get inscription content
  public async getInscriptionContent(inscriptionId: string): Promise<any> { 
    return this.fetchApi<any>(`/inscriptions/${encodeURIComponent(inscriptionId)}/content`);
  }
}

export default ApiServiceProvider; 