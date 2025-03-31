import ApiService from './apiService';
import { ApiServiceConfig } from './types';

// Define the API Provider types
export enum ApiProviderType {
  ORDISCAN = 'ORDISCAN',
  ORD_REG_TEST_NODE = 'ORD_REG_TEST_NODE'
}

/**
 * Provides API service instance for the backend
 */
class ApiServiceProvider {
  private static instance: ApiServiceProvider;
  private apiService: ApiService;

  private constructor() {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    this.apiService = new ApiService(backendUrl);
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
   * Get the current API service instance
   */
  public getApiService(): ApiService {
    return this.apiService;
  }

  /**
   * Update the API service configuration
   */
  public updateConfig(config: ApiServiceConfig): void {
    this.apiService = new ApiService(config.baseUrl);
  }

  /**
   * Check if the API is available
   */
  public async checkApiStatus(): Promise<boolean> {
    try {
      return await this.apiService.checkApiStatus();
    } catch (error) {
      console.error('Error checking API status:', error);
      return false;
    }
  }
}

export default ApiServiceProvider; 