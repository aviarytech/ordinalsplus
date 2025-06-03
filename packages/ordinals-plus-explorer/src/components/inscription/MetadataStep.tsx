import React, { useState, useEffect } from 'react';
import { useResourceInscription } from './ResourceInscriptionWizard';
import { Button } from '../ui';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { VCApiProvider } from '../settings/VCApiProviderSettings';
import { Switch } from '../ui';
import { fetchWorkflowConfiguration, createExchange, participateInExchange } from '../../services/vcApiService';

/**
 * MetadataStep handles the configuration of metadata for the resource inscription.
 * Supports both standard JSON metadata and verifiable credential options.
 */
const MetadataStep: React.FC = () => {
  const { state, setMetadata, nextStep, previousStep, validationErrors, setError, clearError } = useResourceInscription();
  
  // Local state for form handling
  const [isVerifiableCredential, setIsVerifiableCredential] = useState<boolean>(
    state.metadata.isVerifiableCredential
  );
  const [standardMetadata, setStandardMetadata] = useState<string>(
    JSON.stringify(state.metadata.standard, null, 2)
  );
  const [selectedVcProviderId, setSelectedVcProviderId] = useState<string | null>(
    state.metadata.verifiableCredential.provider
  );
  const [workflowConfig, setWorkflowConfig] = useState<any>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [exchangeVariables, setExchangeVariables] = useState<Record<string, string>>({});
  const [isCreatingExchange, setIsCreatingExchange] = useState(false);
  const [exchangeError, setExchangeError] = useState<string | null>(null);
  
  // Get VC API providers from local storage
  const [vcApiProviders] = useLocalStorage<VCApiProvider[]>('vc-api-providers', []);
  
  const handleVcToggle = (checked: boolean) => {
    setIsVerifiableCredential(checked);
    if (!checked) {
      setSelectedVcProviderId(null);
    }
  };

  const handleStandardMetadataChange = (value: string) => {
    setStandardMetadata(value);
    clearError('standardMetadata');
  };
  
  const handleVcProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const providerId = e.target.value === '' ? null : e.target.value;
    setSelectedVcProviderId(providerId);
    
    // Reset workflow config and variables when provider changes
    setWorkflowConfig(null);
    setExchangeVariables({});
    setConfigError(null);
    setExchangeError(null);
    
    // Fetch workflow configuration if provider is selected
    if (providerId) {
      fetchProviderWorkflowConfig(providerId);
    }
  };
  
  // Fetch workflow configuration for the selected provider
  const fetchProviderWorkflowConfig = async (providerId: string) => {
    try {
      setIsLoadingConfig(true);
      setConfigError(null);
      
      const config = await fetchWorkflowConfiguration(providerId);
      setWorkflowConfig(config);
      
      // Initialize variables with default values if available
      if (config?.formatted?.variables) {
        const initialVariables: Record<string, string> = {};
        Object.entries(config.formatted.variables).forEach(([key, value]: [string, any]) => {
          initialVariables[key] = value.default || '';
        });
        setExchangeVariables(initialVariables);
      }
    } catch (err) {
      console.error('Error loading workflow configuration:', err);
      setConfigError('Failed to load workflow configuration');
      setWorkflowConfig(null);
    } finally {
      setIsLoadingConfig(false);
    }
  };
  
  // Handle variable input changes
  const handleVariableChange = (key: string, value: string) => {
    setExchangeVariables(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Load workflow configuration when component mounts if provider is already selected
  useEffect(() => {
    if (isVerifiableCredential && selectedVcProviderId && !workflowConfig && !isLoadingConfig) {
      fetchProviderWorkflowConfig(selectedVcProviderId);
    }
  }, [isVerifiableCredential, selectedVcProviderId]);
  
  // Validate standard metadata JSON
  const validateStandardMetadata = (): boolean => {
    if (!isVerifiableCredential && standardMetadata.trim()) {
      try {
        JSON.parse(standardMetadata);
        return true;
      } catch (err) {
        setError('standardMetadata', 'Invalid JSON format. Please check your syntax.');
        return false;
      }
    }
    return true;
  };

  // Validate VC provider and variables if enabled
  const validateForm = (): boolean => {
    let isValid = true;
    
    // Validate standard metadata if not using verifiable credentials
    if (!validateStandardMetadata()) {
      isValid = false;
    }
    
    if (isVerifiableCredential) {
      // Validate provider selection
      if (!selectedVcProviderId) {
        isValid = false;
        setError('vcProvider', 'Please select a VC provider');
      }
      
      // Validate required variables if workflow config is loaded
      if (workflowConfig?.formatted?.variables) {
        Object.entries(workflowConfig.formatted.variables).forEach(([key, value]: [string, any]) => {
          if (value.required && (!exchangeVariables[key] || exchangeVariables[key].trim() === '')) {
            isValid = false;
            setError(`variable_${key}`, `${value.label || key} is required`);
          }
        });
      }
    }
    
    return isValid;
  };
  
  // Create exchange, participate in it, and continue to next step
  const handleContinue = async () => {
    if (!validateForm()) {
      return;
    }
    
    // Parse standard metadata
    let parsedStandardMetadata = {};
    if (!isVerifiableCredential && standardMetadata.trim()) {
      try {
        parsedStandardMetadata = JSON.parse(standardMetadata);
      } catch (err) {
        setError('standardMetadata', 'Invalid JSON format. Please check your syntax.');
        return;
      }
    }
    
    // If verifiable credential is enabled, create and participate in an exchange
    if (isVerifiableCredential && selectedVcProviderId) {
      try {
        setIsCreatingExchange(true);
        setExchangeError(null);
        
        // Step 1: Create exchange with the provider
        const exchangeData = await createExchange(selectedVcProviderId, {
          variables: exchangeVariables
        });
        
        // Step 2: Participate in the exchange
        if (exchangeData && exchangeData.id) {
          try {
            // Participate in the exchange using the exchange ID
            const participationResponse = await participateInExchange(
              selectedVcProviderId,
              exchangeData.id,
              exchangeVariables
            );
            
            // Extract the verifiable credential from the participation response
            let verifiableCredential = null;
            if (participationResponse?.verifiablePresentation?.verifiableCredential) {
              // Get the first credential from the array (typically there's only one)
              verifiableCredential = participationResponse.verifiablePresentation.verifiableCredential[0];
            }
            
            // Combine the exchange data with the extracted credential
            const completeExchangeData = {
              ...exchangeData,
              participation: participationResponse,
              credential: verifiableCredential
            };
            
            // Update metadata in state with complete exchange data
            setMetadata({
              isVerifiableCredential,
              standard: parsedStandardMetadata, // Include any standard metadata even with VC
              verifiableCredential: {
                provider: selectedVcProviderId,
                exchangeVariables: exchangeVariables,
                exchangeData: completeExchangeData, // Store the complete exchange data
                credential: completeExchangeData.credential // Store the extracted credential separately for easy access
              }
            });
            
            nextStep();
          } catch (participateErr) {
            console.error('Error participating in exchange:', participateErr);
            setExchangeError('Failed to participate in exchange. Please try again.');
          }
        } else {
          throw new Error('Exchange creation did not return a valid exchange ID');
        }
      } catch (err) {
        console.error('Error in exchange process:', err);
        setExchangeError(err instanceof Error ? err.message : 'Failed to complete exchange process. Please try again.');
      } finally {
        setIsCreatingExchange(false);
      }
    } else {
      // If verifiable credential is disabled, just update metadata and continue
      setMetadata({
        isVerifiableCredential,
        standard: parsedStandardMetadata, // Use parsed standard metadata
        verifiableCredential: {
          provider: null,
          exchangeVariables: {},
          credential: null
        }
      });
      
      nextStep();
    }
  };
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
        Configure Resource Metadata
      </h2>
      
      <div className="space-y-4">
        {/* Standard Metadata Section */}
        {!isVerifiableCredential && (
          <div className="pb-4">
            <div>
              <label htmlFor="standardMetadata" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Standard Metadata (JSON)
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Enter metadata as valid JSON. Leave empty if no metadata is needed.
              </p>
              <textarea
                id="standardMetadata"
                value={standardMetadata}
                onChange={(e) => handleStandardMetadataChange(e.target.value)}
                placeholder='{\n  "name": "My Resource",\n  "description": "A sample resource",\n  "author": "Creator Name",\n  "tags": ["tag1", "tag2"]\n}'
                rows={10}
                className={`w-full p-3 border ${
                  validationErrors.standardMetadata ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm`}
              />
              {validationErrors.standardMetadata && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.standardMetadata}</p>
              )}
            </div>
          </div>
        )}

        {/* Verifiable Credential Toggle */}
        <div className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Verifiable Credential
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Enable to create a resource with verifiable credential metadata
              </p>
            </div>
            <Switch
              checked={isVerifiableCredential}
              onCheckedChange={handleVcToggle}
              aria-label="Enable verifiable credential"
            />
          </div>
          
          {/* VC Provider Selection */}
          {isVerifiableCredential && (
            <div className="space-y-4 mt-4">
              <div>
                <label htmlFor="vcProvider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  VC Provider
                </label>
                <select
                  id="vcProvider"
                  value={selectedVcProviderId || ''}
                  onChange={handleVcProviderChange}
                  disabled={isLoadingConfig || isCreatingExchange}
                  className={`w-full p-2 border ${
                    validationErrors.vcProvider ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                >
                  <option value="">Select a provider</option>
                  {vcApiProviders.map(provider => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name}
                    </option>
                  ))}
                </select>
                {validationErrors.vcProvider && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.vcProvider}</p>
                )}
                
                {vcApiProviders.length === 0 && (
                  <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                    No VC API providers configured. Please add a provider in the settings.
                  </p>
                )}
              </div>
              
              {/* Loading state for workflow configuration */}
              {isLoadingConfig && (
                <div className="py-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Loading workflow configuration...
                  </p>
                </div>
              )}
              
              {/* Configuration error */}
              {configError && (
                <div className="py-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {configError}
                  </p>
                </div>
              )}
              
              {/* Dynamic form fields based on workflow configuration */}
              {!isLoadingConfig && workflowConfig?.formatted?.variables && (
                <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Exchange Variables
                  </h4>
                  
                  {Object.entries(workflowConfig.formatted.variables).map(([key, value]: [string, any]) => (
                    <div key={key}>
                      <label 
                        htmlFor={`variable-${key}`} 
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        {value.label || key}{value.required ? ' *' : ''}
                      </label>
                      <input
                        id={`variable-${key}`}
                        type="text"
                        value={exchangeVariables[key] || ''}
                        onChange={(e) => handleVariableChange(key, e.target.value)}
                        placeholder={value.placeholder || ''}
                        disabled={isCreatingExchange}
                        className={`w-full p-2 border ${
                          validationErrors[`variable_${key}`] ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                        } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100`}
                      />
                      {value.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {value.description}
                        </p>
                      )}
                      {validationErrors[`variable_${key}`] && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {validationErrors[`variable_${key}`]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {/* Exchange error */}
              {exchangeError && (
                <div className="py-2">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {exchangeError}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          onClick={previousStep}
          variant="outline"
          className="px-4 py-2"
        >
          Back
        </Button>
        
        <Button
          onClick={handleContinue}
          disabled={
            isCreatingExchange || 
            isLoadingConfig || 
            (isVerifiableCredential && !selectedVcProviderId)
          }
          className="px-4 py-2"
        >
          {isCreatingExchange ? 'Processing Credential...' : 'Continue'}
        </Button>
      </div>
    </div>
  );
};

export default MetadataStep;
