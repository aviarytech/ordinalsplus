import { useEffect, useState } from 'react';
import ApiServiceProvider, { ApiProviderType } from '../services/ApiServiceProvider';
import { env } from '../config/envConfig';

/**
 * Custom hook that provides access to the API service provider
 */
export const useApiService = () => {
  const [apiProvider, setApiProvider] = useState<ApiServiceProvider>(
    ApiServiceProvider.getInstance()
  );
  const [_, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    const provider = ApiServiceProvider.getInstance();
    
    // Get backend URL from environment with fallback
    const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:3000';
    
    // Configure the API service with the backend URL
    provider.updateConfig({
      type: ApiProviderType.ORDISCAN,
      baseUrl: backendUrl,
    });

    setApiProvider(provider);

    // Check API status
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
  }, []);

  return apiProvider;
}; 