import { Inscription, InscriptionResponse, ApiOptions } from '../../types';
import { BaseOrdinalsProvider } from './IOrdinalsProvider';

/**
 * OrdiscanProvider - Implements the Ordinals provider interface for the Ordiscan API
 */
export class OrdiscanProvider extends BaseOrdinalsProvider {
  private apiKey: string | undefined;
  
  constructor(options?: ApiOptions) {
    super();
    this.init(options);
  }
  
  /**
   * Initialize the provider with options
   */
  init(options?: ApiOptions): void {
    super.init(options);
    this.options.endpoint = options?.endpoint || 'https://api.ordiscan.com/v1';
    this.apiKey = options?.apiKey;
    
    if (!this.apiKey) {
      console.warn('Ordiscan API key not provided. API requests will likely fail.');
    }
  }
  
  /**
   * Get the headers for API requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    
    return headers;
  }
  
  /**
   * Check if the Ordiscan API is available
   */
  async getStatus(): Promise<{ status: 'available' | 'unavailable', message: string }> {
    if (!this.apiKey) {
      return { 
        status: 'unavailable',
        message: 'Ordiscan API key not configured'
      };
    }
    
    try {
      // Test the API by fetching a small amount of inscriptions
      const response = await fetch(`${this.options.endpoint}/inscriptions?limit=1`, {
        headers: this.getHeaders()
      });
      
      return { 
        status: response.ok ? 'available' : 'unavailable',
        message: response.ok ? 'Ordiscan API is available' : `Ordiscan API returned status ${response.status}`
      };
    } catch (error) {
      return { 
        status: 'unavailable',
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Maps Ordiscan API response to our Inscription type
   */
  private mapOrdiscanInscription(ordiscanInscription: any): Inscription {
    return {
      id: ordiscanInscription.id,
      number: ordiscanInscription.number,
      content_type: ordiscanInscription.content_type,
      content: ordiscanInscription.content,
      sat: ordiscanInscription.sat,
      sat_ordinal: ordiscanInscription.sat_ordinal,
      genesis_address: ordiscanInscription.owner_address || '',
      genesis_fee: ordiscanInscription.genesis_fee,
      genesis_height: ordiscanInscription.genesis_height,
      genesis_transaction: ordiscanInscription.genesis_transaction,
      timestamp: ordiscanInscription.timestamp,
      value: ordiscanInscription.value
    };
  }
  
  /**
   * Fetch inscriptions from the Ordiscan API
   */
  async fetchInscriptions(offset = 0, limit = 100): Promise<InscriptionResponse> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (offset > 0) {
        params.append('after', offset.toString());
      }
      params.append('limit', limit.toString());
      
      const url = `${this.options.endpoint}/inscriptions?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
      }
      
      const responseData = await response.json() as { data?: any[] };
      
      // Check if the response has a 'data' property that contains the actual results
      const ordiscanInscriptions = responseData.data || [];
      
      // Map the Ordiscan inscriptions to our Inscription type
      const inscriptions = Array.isArray(ordiscanInscriptions) 
        ? ordiscanInscriptions.map(insc => this.mapOrdiscanInscription(insc))
        : [];
      
      return {
        limit,
        offset,
        total: inscriptions.length,
        results: inscriptions
      };
    } catch (error) {
      return this.handleError(error, 'fetchInscriptions');
    }
  }
  
  /**
   * Fetch a specific inscription by ID
   */
  async fetchInscriptionById(inscriptionId: string): Promise<Inscription | null> {
    try {
      const url = `${this.options.endpoint}/inscription/${inscriptionId}`;
      
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
      }
      
      const responseData = await response.json() as { data?: any };
      
      // Extract the inscription data from the 'data' property if present
      const ordiscanInscription = responseData.data || responseData;
      
      // Map to our Inscription type
      return this.mapOrdiscanInscription(ordiscanInscription);
    } catch (error) {
      return this.handleError(error, `fetchInscriptionById(${inscriptionId})`);
    }
  }
  
  /**
   * Fetch the content of an inscription
   */
  async fetchInscriptionContent(inscriptionId: string, contentType: string): Promise<any> {
    try {
      // For binary content types, we can't fetch the content directly
      if (contentType.startsWith('image/') || 
          contentType.startsWith('video/') || 
          contentType.startsWith('audio/')) {
        return null;
      }
      
      // For text content or JSON, we can fetch it directly
      const contentUrl = `https://ordiscan.com/content/${inscriptionId}`;
      
      const response = await fetch(contentUrl);
      
      if (!response.ok) {
        // Return default values based on content type
        if (contentType.includes('application/json')) {
          return {};
        } else if (contentType.includes('text/')) {
          return '';
        }
        return null;
      }
      
      // Process content based on content type
      if (contentType.includes('application/json')) {
        try {
          return await response.json();
        } catch (e) {
          return {};
        }
      } else {
        return await response.text();
      }
    } catch (error) {
      console.warn(`Failed to fetch content for inscription ${inscriptionId}:`, error);
      // Return default values based on content type
      if (contentType.includes('application/json')) {
        return {};
      } else if (contentType.includes('text/')) {
        return '';
      }
      return null;
    }
  }
  
  /**
   * Search inscriptions by content
   * This implementation currently just returns all inscriptions
   */
  async searchInscriptionsByContent(_searchQuery: string, offset = 0, limit = 100): Promise<InscriptionResponse> {
    // Simply fetch all inscriptions for now
    return this.fetchInscriptions(offset, limit);
  }
} 