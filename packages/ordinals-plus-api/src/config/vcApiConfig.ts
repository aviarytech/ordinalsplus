/**
 * Verifiable Credential API Configuration
 * 
 * This file defines the configuration for various VC API providers that can be used
 * with the Ordinals Plus platform. Users can configure multiple providers through
 * environment variables and select which one to use when creating verifiable credentials.
 */

/**
 * Interface for a VC API provider configuration
 */
export interface VCApiProviderConfig {
  /** Unique identifier for the provider */
  id: string;
  /** Display name for the provider */
  name: string;
  /** API endpoint URL */
  url: string;
  /** Authentication token or API key */
  authToken: string;
  /** Whether this is the default provider */
  isDefault: boolean;
}

/**
 * Parse environment variables to extract VC API provider configurations
 * 
 * Environment variables should follow this format:
 * - VC_API_PROVIDER_[index]_NAME: Display name for the provider
 * - VC_API_PROVIDER_[index]_URL: API endpoint URL
 * - VC_API_PROVIDER_[index]_AUTH_TOKEN: Authentication token or API key
 * - VC_API_DEFAULT_PROVIDER: ID of the default provider
 * 
 * Example:
 * VC_API_PROVIDER_1_NAME=Aces VC API
 * VC_API_PROVIDER_1_URL=https://api.aces.example.com
 * VC_API_PROVIDER_1_AUTH_TOKEN=abc123
 * VC_API_PROVIDER_2_NAME=Internal VC Service
 * VC_API_PROVIDER_2_URL=https://vc-api.internal.example.com
 * VC_API_PROVIDER_2_AUTH_TOKEN=xyz789
 * VC_API_DEFAULT_PROVIDER=1
 * 
 * @returns Array of configured VC API providers
 */
import { env } from './envConfig';

export function getVCApiProviders(): VCApiProviderConfig[] {
  const providers: VCApiProviderConfig[] = [];
  const defaultProviderId = env.VC_API_DEFAULT_PROVIDER || '1';
  
  // Find all provider configurations in environment variables
  for (let i = 1; i <= 10; i++) { // Support up to 10 providers
    const nameEnvVar = `VC_API_PROVIDER_${i}_NAME`;
    const urlEnvVar = `VC_API_PROVIDER_${i}_URL`;
    const authTokenEnvVar = `VC_API_PROVIDER_${i}_AUTH_TOKEN`;
    
    const name = process.env[nameEnvVar];
    const url = process.env[urlEnvVar];
    const authToken = process.env[authTokenEnvVar];
    
    // If any of the required values are missing, skip this provider
    if (!name || !url || !authToken) {
      continue;
    }
    
    providers.push({
      id: i.toString(),
      name,
      url,
      authToken,
      isDefault: i.toString() === defaultProviderId
    });
  }
  
  // If no providers are configured, add a default one with placeholder values
  if (providers.length === 0) {
    console.warn('No VC API providers configured. Using placeholder configuration.');
    providers.push({
      id: '1',
      name: 'Default VC API',
      url: env.VC_API_URL || 'https://api.example.com/vc',
      authToken: env.VC_API_AUTH_TOKEN || 'placeholder-token',
      isDefault: true
    });
  }
  
  // Ensure at least one provider is marked as default
  if (providers.length > 0 && !providers.some(p => p.isDefault)) {
    providers[0].isDefault = true;
  }
  
  return providers;
}

/**
 * Get the default VC API provider configuration
 * 
 * @returns The default VC API provider configuration
 */
export function getDefaultVCApiProvider(): VCApiProviderConfig {
  const providers = getVCApiProviders();
  
  // First try to find a provider marked as default
  const defaultProvider = providers.find(p => p.isDefault);
  if (defaultProvider) {
    return defaultProvider;
  }
  
  // If no default provider is found, use the first provider if available
  if (providers.length > 0) {
    return providers[0];
  }
  
  // This should never happen because getVCApiProviders always returns at least one provider
  // But just in case, return a fallback provider to satisfy TypeScript
  console.error('No VC API providers found. Using emergency fallback configuration.');
  return {
    id: 'fallback',
    name: 'Emergency Fallback Provider',
    url: env.VC_API_URL || 'https://api.example.com/vc',
    authToken: env.VC_API_AUTH_TOKEN || 'placeholder-token',
    isDefault: true
  };
}

/**
 * Get a specific VC API provider by ID
 * 
 * @param id - The ID of the provider to get
 * @returns The provider with the specified ID, or the default provider if not found
 */
export function getVCApiProviderById(id: string): VCApiProviderConfig {
  if (!id) {
    console.warn('No provider ID specified. Using default provider.');
    return getDefaultVCApiProvider();
  }
  
  const providers = getVCApiProviders();
  const provider = providers.find(p => p.id === id);
  
  if (!provider) {
    console.warn(`VC API provider with ID ${id} not found. Using default provider.`);
    return getDefaultVCApiProvider();
  }
  
  return provider;
}
