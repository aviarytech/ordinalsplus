import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchSystemVCApiProviders, fetchWorkflowConfiguration } from '../../services/vcApiService';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import './VCApiProviderSettings.css';

// Interface for a VC API provider configuration
export interface VCApiProvider {
  id: string;
  name: string;
  url: string;
  hasAuthToken: boolean;
  isDefault: boolean;
  isSystemProvider?: boolean;
}

/**
 * Extract domain from a URL
 * 
 * @param url - The full URL to extract domain from
 * @returns The domain part of the URL
 */
const extractDomain = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    // If URL parsing fails, return the original URL
    return url;
  }
};

/**
 * VCApiProviderSettings Component
 * 
 * A read-only view of VC API providers configured on the server.
 * Providers are configured through environment variables and cannot be
 * modified through the UI.
 */
export const VCApiProviderSettings: React.FC = () => {
  // State for providers
  const [providers, setProviders] = useState<VCApiProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Use local storage to persist providers for use in other components
  const [_, setVcApiProviders] = useLocalStorage<VCApiProvider[]>('vc-api-providers', []);
  
  // State for exchange functionality
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [exchangeId, setExchangeId] = useState<string>('');
  const [workflowConfig, setWorkflowConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  
  // Fetch providers from the server
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true);
        const data = await fetchSystemVCApiProviders();
        setProviders(data);
        
        // Save providers to local storage for use in other components
        setVcApiProviders(data);
        
        // Set the first provider as selected if available
        if (data.length > 0) {
          setSelectedProvider(data[0].id);
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading VC API providers:', err);
        setError('Failed to load VC API providers. Please check server configuration.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProviders();
  }, []);
  
  // Load workflow configuration when provider changes
  useEffect(() => {
    const loadWorkflowConfig = async () => {
      if (!selectedProvider) return;
      
      try {
        setIsLoadingConfig(true);
        setConfigError(null);
        
        const config = await fetchWorkflowConfiguration(selectedProvider);
        setWorkflowConfig(config);
        
        // If there's a default exchange ID in the config, use it
        if (config?.formatted?.defaultExchangeId) {
          setExchangeId(config.formatted.defaultExchangeId);
        }
      } catch (err) {
        console.error('Error loading workflow configuration:', err);
        setConfigError('Failed to load workflow configuration');
        setWorkflowConfig(null);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    
    loadWorkflowConfig();
  }, [selectedProvider]);
  
  // Handle provider selection change
  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedProvider(e.target.value);
    setExchangeId(''); // Reset exchange ID when provider changes
  };
  
  // Handle exchange ID input change
  const handleExchangeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setExchangeId(e.target.value);
  };
  
  return (
    <div className="vc-api-settings">
      <div className="vc-api-settings-header">
        <h3>Verifiable Credential API Providers</h3>
        <p className="description">
          VC API providers are configured through environment variables on the server.
          Contact your administrator to modify these settings.
        </p>
      </div>
      
      {/* Exchange Participation Section */}
      <div className="exchange-participation-section">
        <h3>Participate in Exchange</h3>
        <p className="description">
          Use this form to participate in an exchange with a VC API provider.
          You'll need to select a provider and enter an exchange ID.
        </p>
        
        <div className="exchange-form">
          <div className="form-group">
            <label htmlFor="provider-select">Select Provider:</label>
            <select 
              id="provider-select" 
              value={selectedProvider} 
              onChange={handleProviderChange}
              disabled={isLoading || providers.length === 0}
            >
              {providers.length === 0 && <option value="">No providers available</option>}
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="exchange-id">Exchange ID:</label>
            <input 
              type="text" 
              id="exchange-id" 
              value={exchangeId} 
              onChange={handleExchangeIdChange}
              placeholder="Enter exchange ID"
              disabled={!selectedProvider || isLoadingConfig}
            />
          </div>
          
          {isLoadingConfig && (
            <div className="loading-indicator">
              <p>Loading workflow configuration...</p>
            </div>
          )}
          
          {configError && (
            <div className="error-message">
              <p>{configError}</p>
            </div>
          )}
          
          {workflowConfig && (
            <div className="workflow-info">
              <p>
                <strong>Available Variables:</strong>{' '}
                {Object.keys(workflowConfig?.formatted?.variables || {}).join(', ') || 'None'}
              </p>
            </div>
          )}
          
          <div className="form-actions">
            <Link 
              to={`/exchange/${selectedProvider}/${exchangeId}`}
              className={`participate-button ${(!selectedProvider || !exchangeId) ? 'disabled' : ''}`}
              onClick={(e) => {
                if (!selectedProvider || !exchangeId) {
                  e.preventDefault();
                }
              }}
            >
              Participate in Exchange
            </Link>
          </div>
        </div>
      </div>
      
      {isLoading && (
        <div className="loading-indicator">
          <p>Loading providers...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {!isLoading && !error && providers.length === 0 && (
        <div className="empty-state">
          <p>No VC API providers configured.</p>
          <p className="help-text">
            Add VC API provider configuration to your server's environment variables.
          </p>
        </div>
      )}
      
      {!isLoading && !error && providers.length > 0 && (
        <div className="providers-list">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Domain</th>
                <th>Authentication</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider: VCApiProvider) => (
                <tr key={provider.id} className={provider.isDefault ? 'default-provider' : ''}>
                  <td>{provider.name}</td>
                  <td>
                    <a href={provider.url} target="_blank" rel="noopener noreferrer" title={provider.url}>
                      {extractDomain(provider.url)}
                    </a>
                  </td>
                  <td>
                    {provider.hasAuthToken ? (
                      <span className="auth-configured">Configured</span>
                    ) : (
                      <span className="auth-missing">Missing</span>
                    )}
                  </td>
                  <td>
                    {provider.isDefault && (
                      <span className="default-badge">Default</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="env-var-help">
        <h4>Example Environment Variable Format</h4>
        <div className="env-var-code">
          <div className="env-var-line"><span className="env-var-name">VC_API_PROVIDER_1_NAME</span>=<span className="env-var-value">"Provider Name"</span></div>
          <div className="env-var-line"><span className="env-var-name">VC_API_PROVIDER_1_URL</span>=<span className="env-var-value">"https://api.example.com"</span></div>
          <div className="env-var-line"><span className="env-var-name">VC_API_PROVIDER_1_AUTH_TOKEN</span>=<span className="env-var-value">"your-auth-token"</span></div>
          <div className="env-var-line"><span className="env-var-name">VC_API_DEFAULT_PROVIDER</span>=<span className="env-var-value">"1"</span></div>
        </div>
        <p className="help-text">Add these variables to your server's <code>.env</code> file to configure providers.</p>
      </div>
    </div>
  );
};

export default VCApiProviderSettings;
