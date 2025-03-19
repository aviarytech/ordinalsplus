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
          baseUrl: 'http://localhost:9001',
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
    // We'll use the existing fetchInscriptionsByAddress method with an empty string
    // Later we'll implement a more specific method in the service classes
    return this.apiService.fetchInscriptionsByAddress('', page, limit);
  }
  
  /**
   * Get the content URL for a specific inscription
   * @param inscriptionId The inscription ID to get content for
   */
  public getContentUrl(inscriptionId: string): string {
    // Return the content URL based on the current API service
    // This is particularly useful for image resources
    return `${this.config.baseUrl}/content/${inscriptionId}`;
  }
  
  /**
   * Check if the API service is available
   */
  public async checkApiStatus(): Promise<boolean> {
    if (this.apiService instanceof OrdNodeService) {
      return this.apiService.checkNodeStatus();
    }
    // For other API services
    return true;
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