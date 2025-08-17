import { env } from '../config/envConfig';
import { VCApiProvider } from '../components/settings/VCApiProviderSettings';


/**
 * Fetches VC API providers configured in the server environment
 * 
 * @returns Promise that resolves to an array of system-configured VC API providers
 */
export async function fetchSystemVCApiProviders(): Promise<VCApiProvider[]> {
  try {
    const response = await fetch(`${env.VITE_BACKEND_URL}/api/vc-api/providers`);
    
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
    const response = await fetch(`${env.VITE_BACKEND_URL}/api/vc-api/providers/default`);
    
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

/**
 * Creates an exchange with a VC API provider
 * 
 * @param providerId - ID of the VC API provider
 * @param options - Options for creating the exchange
 * @returns Promise that resolves to the created exchange data
 */
export async function createExchange(
  providerId: string,
  options: {
    type?: string;
    issuer?: string;
    subject?: string;
    [key: string]: any;
  }
): Promise<any> {
  try {
    const response = await fetch(
      `${env.VITE_BACKEND_URL}/api/vc-api/providers/${providerId}/exchanges`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create exchange: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating exchange:', error);
    throw error;
  }
}

/**
 * Fetches the workflow configuration for a VC API provider
 * 
 * @param providerId - ID of the VC API provider
 * @returns Promise that resolves to the workflow configuration
 */
export async function fetchWorkflowConfiguration(providerId: string): Promise<any> {
  try {
    const response = await fetch(`${env.VITE_BACKEND_URL}/api/vc-api/providers/${providerId}/workflow-configuration`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch workflow configuration: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching workflow configuration:', error);
    throw error;
  }
}

/**
 * Participates in an exchange with a VC API provider using form variables
 * 
 * @param providerId - ID of the VC API provider
 * @param exchangeId - ID of the exchange to participate in
 * @param variables - Variables to use in the exchange (from form inputs)
 * @returns Promise that resolves to the exchange participation response
 */
export async function participateInExchange(
  providerId: string, 
  exchangeId: string, 
  variables: Record<string, string>
): Promise<any> {
  try {
    const response = await fetch(
      `${env.VITE_BACKEND_URL}/api/vc-api/providers/${providerId}/exchanges/${exchangeId}/participate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ variables })
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to participate in exchange: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error participating in exchange:', error);
    throw error;
  }
}
