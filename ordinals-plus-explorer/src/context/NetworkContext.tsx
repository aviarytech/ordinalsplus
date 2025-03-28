import React, { createContext, useContext, useState, useEffect } from 'react';
import ApiServiceProvider, { ApiProviderType, ApiServiceConfig } from '../services/ApiServiceProvider';

// Define network configurations - all connections now go through the backend
const NETWORK_CONFIGS: Record<ApiProviderType, ApiServiceConfig> = {
  [ApiProviderType.ORDISCAN]: {
    type: ApiProviderType.ORDISCAN,
    baseUrl: 'http://localhost:3000', // Backend server URL
  },
  [ApiProviderType.ORD_NODE]: {
    type: ApiProviderType.ORD_NODE,
    baseUrl: 'http://localhost:3000', // Backend server URL (not direct to Ord node)
  },
};

// Define the context type
interface NetworkContextType {
  currentNetwork: ApiProviderType;
  setNetwork: (network: ApiProviderType) => void;
  networkConfig: ApiServiceConfig;
  isConnected: boolean;
  resetInscriptions: () => void;
}

// Create the context with default values
const NetworkContext = createContext<NetworkContextType>({
  currentNetwork: ApiProviderType.ORD_NODE,
  setNetwork: () => {},
  networkConfig: NETWORK_CONFIGS[ApiProviderType.ORD_NODE],
  isConnected: false,
  resetInscriptions: () => {},
});

// Custom hook to use the network context
export const useNetwork = () => useContext(NetworkContext);

// Provider component
export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize network configurations from environment variables
  useEffect(() => {
    // Get backend URL from environment, with fallback
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    
    console.log('Initializing network configurations with backend URL:', backendUrl);
    
    // Both network types now use the same backend URL
    NETWORK_CONFIGS[ApiProviderType.ORDISCAN].baseUrl = backendUrl;
    NETWORK_CONFIGS[ApiProviderType.ORD_NODE].baseUrl = backendUrl;
  }, []);

  // Get stored network from localStorage or default to ORD_NODE
  const getInitialNetwork = (): ApiProviderType => {
    // Check localStorage first
    const storedNetwork = localStorage.getItem('currentNetwork');
    
    // If there's a valid stored network, use it
    if (storedNetwork && Object.values(ApiProviderType).includes(storedNetwork as ApiProviderType)) {
      return storedNetwork as ApiProviderType;
    }
    
    // If not, check environment
    const envDefault = import.meta.env.VITE_DEFAULT_NETWORK;
    if (envDefault === 'mainnet') {
      return ApiProviderType.ORDISCAN;
    }
    
    // Default to local node
    return ApiProviderType.ORD_NODE;
  };
  
  const [currentNetwork, setCurrentNetwork] = useState<ApiProviderType>(getInitialNetwork);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  const networkConfig = NETWORK_CONFIGS[currentNetwork];
  
  // Function to reset inscriptions - will be used by components to clear their state
  const resetInscriptions = () => {
    // Create a custom event that components can listen for
    const resetEvent = new CustomEvent('resetInscriptions');
    window.dispatchEvent(resetEvent);
    console.log('Reset inscriptions triggered due to network change');
  };
  
  // Update the ApiServiceProvider when network changes
  const setNetwork = (network: ApiProviderType) => {
    // Only proceed if the network is actually changing
    if (network !== currentNetwork) {
      console.log(`Changing network from ${currentNetwork} to ${network}`);
      
      // Update state and localStorage
      setCurrentNetwork(network);
      localStorage.setItem('currentNetwork', network);
      
      // Update the API service provider
      ApiServiceProvider.getInstance().updateConfig(NETWORK_CONFIGS[network]);
      
      // Reset inscriptions when network changes
      resetInscriptions();
      
      // Check connection status
      checkConnection();
    }
  };
  
  // Check connection to the selected network
  const checkConnection = async () => {
    try {
      const apiService = ApiServiceProvider.getInstance();
      const connected = await apiService.checkApiStatus();
      setIsConnected(connected);
    } catch (error) {
      console.error('Error checking API status:', error);
      setIsConnected(false);
    }
  };
  
  // Initialize the API service provider and check connection on mount
  useEffect(() => {
    // Initialize with the current network
    ApiServiceProvider.getInstance().updateConfig(networkConfig);
    
    // Check connection status
    checkConnection();
    
    // Setup a periodic connection check
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  return (
    <NetworkContext.Provider
      value={{
        currentNetwork,
        setNetwork,
        networkConfig,
        isConnected,
        resetInscriptions,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContext; 