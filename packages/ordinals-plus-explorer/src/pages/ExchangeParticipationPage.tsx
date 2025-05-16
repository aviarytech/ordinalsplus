import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchSystemVCApiProviders } from '../services/vcApiService';
import { VCApiProvider } from '../components/settings/VCApiProviderSettings';
import ExchangeParticipationForm from '../components/vc/ExchangeParticipationForm';
import './ExchangeParticipationPage.css';

/**
 * ExchangeParticipationPage Component
 * 
 * A page for participating in exchanges with VC API providers.
 * This page displays a form for entering the required variables
 * and submitting them to participate in an exchange.
 */
export const ExchangeParticipationPage: React.FC = () => {
  // Get provider ID and exchange ID from URL params
  const { providerId, exchangeId } = useParams<{ providerId: string, exchangeId: string }>();
  const navigate = useNavigate();
  
  // State for provider details
  const [provider, setProvider] = useState<VCApiProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load provider details
  useEffect(() => {
    const loadProvider = async () => {
      if (!providerId) {
        setError('No provider ID specified');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        const providers = await fetchSystemVCApiProviders();
        const foundProvider = providers.find(p => p.id === providerId);
        
        if (foundProvider) {
          setProvider(foundProvider);
          setError(null);
        } else {
          setError(`Provider with ID ${providerId} not found`);
        }
      } catch (err) {
        console.error('Error loading provider details:', err);
        setError('Failed to load provider details');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadProvider();
  }, [providerId]);
  
  // Handle successful exchange participation
  const handleExchangeSuccess = (response: any) => {
    console.log('Exchange participation successful:', response);
    // You can add additional handling here, such as redirecting to a success page
  };
  
  // Handle exchange participation error
  const handleExchangeError = (error: Error) => {
    console.error('Exchange participation error:', error);
    // You can add additional error handling here
  };
  
  // Handle back button click
  const handleBack = () => {
    navigate(-1);
  };
  
  return (
    <div className="exchange-participation-page">
      <div className="page-header">
        <button className="back-button" onClick={handleBack}>
          &larr; Back
        </button>
        <h2>Participate in Exchange</h2>
      </div>
      
      {isLoading && (
        <div className="loading-indicator">
          <p>Loading provider details...</p>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      {!isLoading && !error && provider && exchangeId && (
        <div className="exchange-details">
          <div className="provider-info">
            <h3>Provider: {provider.name}</h3>
            <p className="provider-url">URL: {provider.url}</p>
          </div>
          
          <div className="exchange-info">
            <h3>Exchange ID: {exchangeId}</h3>
          </div>
          
          <ExchangeParticipationForm
            providerId={provider.id}
            exchangeId={exchangeId}
            onSuccess={handleExchangeSuccess}
            onError={handleExchangeError}
          />
        </div>
      )}
      
      {!isLoading && !error && (!providerId || !exchangeId) && (
        <div className="missing-params">
          <p>Missing required parameters. Please specify both provider ID and exchange ID.</p>
        </div>
      )}
    </div>
  );
};

export default ExchangeParticipationPage;
