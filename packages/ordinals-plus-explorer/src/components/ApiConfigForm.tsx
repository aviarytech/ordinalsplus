import React, { useState, useEffect } from 'react';
import { Dialog } from 'av1-c';
import { ApiProviderType, ApiServiceConfig } from '../services/ApiServiceProvider';
import fetchClient from '../utils/fetchUtils';

interface ApiProvider {
  available: boolean;
  baseUrl: string;
}

interface ApiConfigResponse {
  providers: {
    ordiscan: ApiProvider;
    ordNode: ApiProvider;
  }
}

interface ApiConfigFormProps {
  config: ApiServiceConfig;
  onConfigChange: (config: ApiServiceConfig) => void;
  isOpen: boolean;
  onClose: () => void;
}

const ApiConfigForm: React.FC<ApiConfigFormProps> = ({
  config,
  onConfigChange,
  isOpen,
  onClose
}) => {
  const [apiType, setApiType] = useState<ApiProviderType>(config.type);
  const [baseUrl, setBaseUrl] = useState<string>(config.baseUrl);
  const [availableProviders, setAvailableProviders] = useState<{[key: string]: ApiProvider}>({
    ordiscan: { available: false, baseUrl: 'https://ordiscan.com' },
    ordNode: { available: true, baseUrl: 'http://127.0.0.1:9001' }
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Fetch available API providers from backend
  useEffect(() => {
    if (isOpen) {
      const fetchProviders = async () => {
        try {
          setLoading(true);
          const response = await fetchClient.get<ApiConfigResponse>('http://localhost:3000/api/config');
          setAvailableProviders(response.data.providers);
          
          // If current provider is not available, switch to an available one
          if (apiType === ApiProviderType.ORDISCAN && !response.data.providers.ordiscan.available) {
            setApiType(ApiProviderType.ORD_NODE);
            setBaseUrl(response.data.providers.ordNode.baseUrl);
          }
          
          setError(null);
        } catch (err) {
          console.error('Failed to fetch API providers:', err);
          setError('Failed to load available API providers');
        } finally {
          setLoading(false);
        }
      };
      
      fetchProviders();
    }
  }, [isOpen, apiType]);
  
  // Update local state when props change
  useEffect(() => {
    setApiType(config.type);
    setBaseUrl(config.baseUrl);
  }, [config]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onConfigChange({
      type: apiType,
      baseUrl: baseUrl.trim(),
      // We don't set apiKey - it will be managed by the backend
    });
    
    onClose();
  };
  
  // When API type changes, update URL with a default
  const handleApiTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as ApiProviderType;
    setApiType(newType);
    
    // Set default URLs based on type
    if (newType === ApiProviderType.ORD_NODE) {
      setBaseUrl(availableProviders.ordNode.baseUrl);
    } else if (newType === ApiProviderType.ORDISCAN) {
      setBaseUrl(availableProviders.ordiscan.baseUrl);
    }
  };
  
  const fetchApiConfig = async () => {
    try {
      setLoading(true);
      const response = await fetchClient.get<ApiConfigResponse>('http://localhost:3000/api/config');
      setAvailableProviders(response.data.providers);
      
      // If current provider is not available, switch to an available one
      if (apiType === ApiProviderType.ORDISCAN && !response.data.providers.ordiscan.available) {
        setApiType(ApiProviderType.ORD_NODE);
        setBaseUrl(response.data.providers.ordNode.baseUrl);
      }
      
      setError(null);
      setFormSuccess(true);
    } catch (err) {
      console.error('Failed to fetch API providers:', err);
      setError('Failed to load available API providers');
      setFormError('Failed to load available API providers');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={onClose}
      title="API Configuration"
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="animate-pulse text-blue-500 mb-4">Loading...</div>
          <p className="text-gray-600 dark:text-gray-400">Loading available API providers...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-red-500 font-medium mb-2">Error loading configuration</p>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-4">{error}</p>
          <button
            onClick={fetchApiConfig}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-5">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Provider
              </label>
              <select
                value={apiType}
                onChange={handleApiTypeChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-blue-500 dark:focus:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {availableProviders.ordiscan.available && (
                  <option value={ApiProviderType.ORDISCAN}>Ordiscan API</option>
                )}
                <option value={ApiProviderType.ORD_NODE}>Ord Node</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={apiType === ApiProviderType.ORD_NODE ? 'http://127.0.0.1:9001' : 'https://ordiscan.com'}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-blue-500 dark:focus:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {apiType === ApiProviderType.ORD_NODE 
                  ? 'URL of your Ord node (e.g. http://127.0.0.1:9001)' 
                  : 'URL of the Ordiscan API'}
              </p>
            </div>
            
            {apiType === ApiProviderType.ORD_NODE && (
              <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="font-bold text-blue-400 dark:text-blue-300">ⓘ</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Using Ord Node</h3>
                    <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      <p>
                        Make sure your Ord node's API is accessible from this browser and set the
                        correct Base URL. You're currently using <code>http://127.0.0.1:9001</code>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {apiType === ApiProviderType.ORDISCAN && (
              <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-3">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="font-bold text-green-400 dark:text-green-300">✓</span>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-300">Using Ordiscan API</h3>
                    <div className="mt-1 text-xs text-green-700 dark:text-green-300">
                      <p>
                        The Ordiscan API key is securely managed by the server. 
                        No need to enter it here.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-650 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            >
              Save Configuration
            </button>
          </div>
        </form>
      )}
      {formSuccess && (
        <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 p-3 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-green-400 dark:text-green-300 font-bold">✓</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                API configuration saved successfully!
              </p>
            </div>
          </div>
        </div>
      )}
      {formError && (
        <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400 dark:text-red-300 font-bold">✗</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                {formError}
              </p>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
};

export default ApiConfigForm; 