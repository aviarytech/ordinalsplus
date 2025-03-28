import { useEffect, useState } from 'react';
import ApiServiceProvider from '../services/ApiServiceProvider';
import { useNetwork } from '../context/NetworkContext';

/**
 * Custom hook that provides access to the API service provider with automatic network switching
 */
export const useApiService = () => {
  const { currentNetwork, isConnected } = useNetwork();
  const [apiProvider, setApiProvider] = useState<ApiServiceProvider>(
    ApiServiceProvider.getInstance()
  );
  const [_, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    const provider = ApiServiceProvider.getInstance();
    
    // Get backend URL from environment with fallback
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
    
    console.log(`Configuring API service for network: ${currentNetwork} using backend: ${backendUrl}`);
    
    // ALWAYS use the backend URL for both network types
    // The backend handles the routing to either Ordiscan or Ord node
    provider.updateConfig({
      type: currentNetwork, // This tells the backend which data source to use
      baseUrl: backendUrl,  // But we always connect to our backend
    });

    setApiProvider(provider);

    // Check API status on network change
    const checkConnection = async () => {
      try {
        setConnectionStatus('checking');
        const isConnected = await provider.checkApiStatus();
        setConnectionStatus(isConnected ? 'connected' : 'disconnected');
      } catch (error) {
        console.error('Error checking API connection:', error);
        setConnectionStatus('disconnected');
      }
    };

    checkConnection();
  }, [currentNetwork, isConnected]);

  return apiProvider;
}; 