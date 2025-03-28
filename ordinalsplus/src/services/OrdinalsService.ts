import { ApiOptions } from '../types';
import { IOrdinalsProvider } from './providers/IOrdinalsProvider';
import { OrdiscanProvider } from './providers/OrdiscanProvider';

/**
 * Provider types supported by the OrdinalsService
 */
export type OrdinalsProviderType = 'ordiscan' | 'ordnode' | 'mock';

/**
 * OrdinalsService - Factory for creating and managing ordinals providers
 */
export class OrdinalsService {
  private static instance: OrdinalsService;
  private providers: Map<OrdinalsProviderType, IOrdinalsProvider> = new Map();
  private defaultProvider: OrdinalsProviderType = 'ordiscan';
  
  /**
   * Get the singleton instance of OrdinalsService
   */
  static getInstance(): OrdinalsService {
    if (!OrdinalsService.instance) {
      OrdinalsService.instance = new OrdinalsService();
    }
    return OrdinalsService.instance;
  }
  
  /**
   * Initialize a provider with options
   */
  initProvider(
    providerType: OrdinalsProviderType,
    options?: ApiOptions
  ): IOrdinalsProvider {
    let provider = this.providers.get(providerType);
    
    if (!provider) {
      provider = this.createProvider(providerType);
      this.providers.set(providerType, provider);
    }
    
    provider.init(options);
    return provider;
  }
  
  /**
   * Set the default provider type
   */
  setDefaultProvider(providerType: OrdinalsProviderType): void {
    this.defaultProvider = providerType;
  }
  
  /**
   * Get a provider instance
   */
  getProvider(providerType?: OrdinalsProviderType): IOrdinalsProvider {
    const type = providerType || this.defaultProvider;
    
    let provider = this.providers.get(type);
    
    if (!provider) {
      provider = this.createProvider(type);
      this.providers.set(type, provider);
    }
    
    return provider;
  }
  
  /**
   * Create a new provider instance
   */
  private createProvider(type: OrdinalsProviderType): IOrdinalsProvider {
    switch (type) {
      case 'ordiscan':
        return new OrdiscanProvider();
      case 'ordnode':
        // Not implemented yet, fallback to Ordiscan
        console.warn('OrdNode provider not implemented yet. Using Ordiscan instead.');
        return new OrdiscanProvider();
      case 'mock':
        // Not implemented yet, fallback to Ordiscan
        console.warn('Mock provider not implemented yet. Using Ordiscan instead.');
        return new OrdiscanProvider();
      default:
        return new OrdiscanProvider();
    }
  }
} 