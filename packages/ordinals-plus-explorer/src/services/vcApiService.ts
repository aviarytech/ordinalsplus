import { VCApiProvider } from '../components/settings/VCApiProviderSettings';

// API server base URL
const API_BASE_URL = 'http://localhost:3005';

/**
 * Fetches VC API providers configured in the server environment
 * 
 * @returns Promise that resolves to an array of system-configured VC API providers
 */
export async function fetchSystemVCApiProviders(): Promise<VCApiProvider[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/vc-api/providers`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch system VC API providers: ${response.statusText}`);
    }
    
    const providers = await response.json();
    
    // Mark all providers as system providers
    return providers.map((provider: VCApiProvider) => ({
      ...provider,
      isSystemProvider: true
    }));
  } catch (error) {
    console.error('Error fetching system VC API providers:', error);
    return [];
  }
}

/**
 * Fetches the default VC API provider from the server
 * 
 * @returns Promise that resolves to the default VC API provider
 */
export async function fetchDefaultVCApiProvider(): Promise<VCApiProvider | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/vc-api/providers/default`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch default VC API provider: ${response.statusText}`);
    }
    
    const provider = await response.json();
    return {
      ...provider,
      isSystemProvider: true
    };
  } catch (error) {
    console.error('Error fetching default VC API provider:', error);
    return null;
  }
}

/**
 * Combines system and user providers, ensuring there's only one default provider
 * 
 * @param systemProviders - Providers from the server environment
 * @param userProviders - Providers from user settings (localStorage)
 * @returns Combined list of providers with consistent default settings
 */
export function combineProviders(
  systemProviders: VCApiProvider[],
  userProviders: VCApiProvider[]
): VCApiProvider[] {
  // Create a copy of all providers
  const allProviders = [
    ...systemProviders,
    ...userProviders
  ];
  
  // Find the default providers
  const defaultSystemProvider = systemProviders.find(p => p.isDefault);
  const defaultUserProvider = userProviders.find(p => p.isDefault);
  
  // If there's both a default system provider and a default user provider,
  // prioritize the user's choice
  if (defaultSystemProvider && defaultUserProvider) {
    const systemProviderIndex = allProviders.findIndex(
      p => p.id === defaultSystemProvider.id && p.isSystemProvider
    );
    
    if (systemProviderIndex !== -1) {
      allProviders[systemProviderIndex] = {
        ...allProviders[systemProviderIndex],
        isDefault: false
      };
    }
  }
  
  // If there's no default provider at all, set the first system provider as default
  if (!allProviders.some(p => p.isDefault) && allProviders.length > 0) {
    const firstSystemProvider = allProviders.findIndex(p => p.isSystemProvider);
    
    if (firstSystemProvider !== -1) {
      allProviders[firstSystemProvider] = {
        ...allProviders[firstSystemProvider],
        isDefault: true
      };
    } else if (allProviders.length > 0) {
      // If no system providers, set the first user provider as default
      allProviders[0] = {
        ...allProviders[0],
        isDefault: true
      };
    }
  }
  
  return allProviders;
}
