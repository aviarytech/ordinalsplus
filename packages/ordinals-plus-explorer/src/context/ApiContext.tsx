/// <reference types="cypress" />
import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import ApiService from '../services/apiService';
import { useNetwork } from './NetworkContext'; // Import useNetwork
import { env } from '../config/envConfig';

// Define the shape of the context data
interface ApiContextType {
  apiService: ApiService | null;
}

// Create the context with a default value
const ApiContext = createContext<ApiContextType>({ apiService: null });

// Define the props for the provider component
interface ApiProviderProps {
  children: ReactNode;
}

// Create the provider component
export const ApiProvider: React.FC<ApiProviderProps> = ({ children }) => {
  // Get the *initial* API base URL from environment variables
  // This will be used if no network context is found or if the network doesn't provide an apiUrl
  const initialApiUrl = env.VITE_BACKEND_URL ||
                        (window.Cypress ? Cypress.env('API_BASE_URL') : undefined);

  // Use the NetworkContext to get the active network
  // REMOVED: We no longer need activeNetwork here directly to change the URL
  // const { network: activeNetwork } = useNetwork();

  // Create the ApiService instance using useMemo so it persists
  const apiServiceInstance = useMemo(() => {
    // Use initial URL only
    const urlToUse = initialApiUrl;
    if (!urlToUse) {
      console.error('[ApiProvider] No initial API URL found (VITE_BACKEND_URL missing?). ApiService not created.');
      return null;
    } 
    console.log(`[ApiProvider] Creating ApiService with base URL: ${urlToUse}`);
    return new ApiService(urlToUse);
  }, [initialApiUrl]); // Only depends on initial URL for creation

  // REMOVED: Effect to update ApiService base URL when activeNetwork changes
  /*
  useEffect(() => {
    if (apiServiceInstance && activeNetwork?.apiUrl) {
      console.log(`[ApiProvider] Network changed to ${activeNetwork.name}. Updating ApiService base URL to: ${activeNetwork.apiUrl}`); 
      apiServiceInstance.setBaseUrl(activeNetwork.apiUrl);
    } else if (apiServiceInstance && !activeNetwork?.apiUrl) {
      console.warn(`[ApiProvider] Active network (${activeNetwork?.name}) changed but has no apiUrl. ApiService URL remains unchanged.`); 
    } else {
    }
  }, [activeNetwork, apiServiceInstance]); // Depend on network and service instance
  */

  // Log if ApiService instance is null
  if (!apiServiceInstance) {
      console.error("[ApiProvider] apiServiceInstance is null. API calls will fail.");
  }

  return (
    <ApiContext.Provider value={{ apiService: apiServiceInstance }}>
      {children}
    </ApiContext.Provider>
  );
};

// Custom hook for easy consumption of the context
export const useApi = (): ApiContextType => {
  const context = useContext(ApiContext);
  if (context === undefined) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  // Return the whole context object which includes apiService
  return context; 
};

// Export the context itself if needed elsewhere (though useApi hook is preferred)
export default ApiContext; 