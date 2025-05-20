import React, { useState, useEffect } from 'react';
import { participateInExchange, fetchWorkflowConfiguration } from '../../services/vcApiService';
import './ExchangeParticipationForm.css';

interface ExchangeParticipationFormProps {
  providerId: string;
  exchangeId: string;
  onSuccess?: (response: any) => void;
  onError?: (error: Error) => void;
}

/**
 * ExchangeParticipationForm Component
 * 
 * A form for participating in an exchange with a VC API provider.
 * This form dynamically loads the workflow configuration to determine
 * which variables are required for the exchange.
 */
export const ExchangeParticipationForm: React.FC<ExchangeParticipationFormProps> = ({
  providerId,
  exchangeId,
  onSuccess,
  onError
}) => {
  // State for form variables
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [variableDescriptions, setVariableDescriptions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [response, setResponse] = useState<any>(null);

  // Load workflow configuration to get variables
  useEffect(() => {
    const loadWorkflowConfig = async () => {
      try {
        setIsLoading(true);
        const config = await fetchWorkflowConfiguration(providerId);
        
        // Extract variables from the workflow configuration
        if (config && config.formatted) {
          setVariables(config.formatted.variables || {});
          setVariableDescriptions(config.formatted.variableDescriptions || {});
        }
        
        setError(null);
      } catch (err) {
        console.error('Error loading workflow configuration:', err);
        setError('Failed to load workflow configuration. Please try again.');
        if (onError) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    loadWorkflowConfig();
  }, [providerId, onError]);

  // Handle form input changes
  const handleInputChange = (key: string, value: string) => {
    setVariables(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Prepare form variables for submission
      const formVariables: Record<string, string> = {};
      
      // Process each variable
      Object.entries(variables).forEach(([key, value]) => {
        // Only include variables with values
        if (value) {
          formVariables[key] = value;
        }
      });
      
      // Submit the exchange participation request
      const result = await participateInExchange(providerId, exchangeId, formVariables);
      
      // Handle success
      setSuccess(true);
      setResponse(result);
      
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Error participating in exchange:', err);
      setError('Failed to participate in exchange. Please check your inputs and try again.');
      
      if (onError) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format variable name for display
  const formatVariableName = (key: string): string => {
    // Remove 'var_' prefix if present
    const name = key.startsWith('var_') ? key.substring(4) : key;
    
    // Convert camelCase or snake_case to Title Case with spaces
    return name
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/^\w/, c => c.toUpperCase()) // Capitalize first letter
      .trim();
  };

  // Get description for a variable
  const getVariableDescription = (key: string): string => {
    return variableDescriptions[key] || `Enter value for ${formatVariableName(key)}`;
  };

  return (
    <div className="exchange-participation-form">
      <h3>Exchange Participation Form</h3>
      
      {isLoading && (
        <div className="loading-indicator">
          <p>Loading form...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {!isLoading && !error && Object.keys(variables).length === 0 && (
        <div className="empty-state">
          <p>No variables found for this exchange.</p>
        </div>
      )}
      
      {success && response && (
        <div className="success-message">
          <h4>Exchange Successful</h4>
          <div className="response-preview">
            <pre>{JSON.stringify(response, null, 2)}</pre>
          </div>
        </div>
      )}
      
      {!isLoading && !error && !success && Object.keys(variables).length > 0 && (
        <form onSubmit={handleSubmit}>
          {Object.entries(variables).map(([key, value]) => (
            <div key={key} className="form-group">
              <label htmlFor={key}>{formatVariableName(key)}</label>
              <input
                type="text"
                id={key}
                name={key}
                value={value}
                onChange={(e) => handleInputChange(key, e.target.value)}
                placeholder={getVariableDescription(key)}
                required
              />
            </div>
          ))}
          
          <div className="form-actions">
            <button 
              type="submit" 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Participate in Exchange'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ExchangeParticipationForm;
