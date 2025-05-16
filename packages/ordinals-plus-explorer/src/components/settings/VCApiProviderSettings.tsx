import React, { useState, useEffect } from 'react';
import { fetchSystemVCApiProviders } from '../../services/vcApiService';
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
  
  // Fetch providers from the server
  useEffect(() => {
    const loadProviders = async () => {
      try {
        setIsLoading(true);
        const data = await fetchSystemVCApiProviders();
        setProviders(data);
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
  
  return (
    <div className="vc-api-settings">
      <div className="vc-api-settings-header">
        <h3>Verifiable Credential API Providers</h3>
        <p className="description">
          VC API providers are configured through environment variables on the server.
          Contact your administrator to modify these settings.
        </p>
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
        <h4>Environment Variable Format</h4>
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
