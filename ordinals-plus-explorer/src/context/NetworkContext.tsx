import React, { createContext, useContext, useState, useEffect } from 'react';
import ApiServiceProvider, { ApiProviderType } from '../services/ApiServiceProvider';
import { NetworkConfig } from '../services/types';

// Define network configurations
const NETWORK_CONFIGS: Record<ApiProviderType, NetworkConfig> = {
  [ApiProviderType.ORDISCAN]: {
    name: 'Mainnet',
    baseUrl: 'http://localhost:3000',
    isTestnet: false
  },
  [ApiProviderType.ORD_REG_TEST_NODE]: {
    name: 'Ord RegTest Node',
    baseUrl: 'http://localhost:3000',
    isTestnet: true
  }
};

// Define the context type
interface NetworkContextType {
  isConnected: boolean;
  currentNetwork: ApiProviderType;
  networks: Record<ApiProviderType, NetworkConfig>;
  setNetwork: (network: ApiProviderType) => void;
}

// Create the context with default values
const NetworkContext = createContext<NetworkContextType>({
  isConnected: false,
  currentNetwork: ApiProviderType.ORD_REG_TEST_NODE,
  networks: NETWORK_CONFIGS,
  setNetwork: () => {},
});

// Custom hook to use the network context
export const useNetwork = () => useContext(NetworkContext);

// Provider component
export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [currentNetwork, setCurrentNetwork] = useState<ApiProviderType>(ApiProviderType.ORD_REG_TEST_NODE);
  
  // Check connection to the API
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

  // Update network settings
  const handleSetNetwork = (network: ApiProviderType) => {
    setCurrentNetwork(network);
    // The backend will handle the actual network configuration
    checkConnection();
  };
  
  // Initialize the API service provider and check connection on mount
  useEffect(() => {
    // Check connection status
    checkConnection();
    
    // Setup a periodic connection check
    const interval = setInterval(checkConnection, 30000);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <NetworkContext.Provider
      value={{
        isConnected,
        currentNetwork,
        networks: NETWORK_CONFIGS,
        setNetwork: handleSetNetwork,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
};

export default NetworkContext; 