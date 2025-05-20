import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collectionService, CollectionVerificationResponse } from '../services/collectionService';
import CollectionVerificationBadge, { VerificationStatus } from '../components/collections/CollectionVerificationBadge';
import CollectionVerificationDetails from '../components/collections/CollectionVerificationDetails';
import './CollectionVerificationPage.css';

/**
 * Page component for verifying collection inscriptions
 */
const CollectionVerificationPage: React.FC = () => {
  const [inscriptionId, setInscriptionId] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<CollectionVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const navigate = useNavigate();
  
  // Handle inscription ID input change
  const handleInscriptionIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInscriptionId(e.target.value);
  };
  
  // Handle collection ID input change
  const handleCollectionIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCollectionId(e.target.value);
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inscriptionId.trim()) {
      setError('Inscription ID is required');
      return;
    }
    
    if (!collectionId.trim()) {
      setError('Collection ID is required');
      return;
    }
    
    try {
      setVerifying(true);
      setError(null);
      
      const result = await collectionService.verifyCollectionInscription(
        inscriptionId.trim(),
        collectionId.trim()
      );
      
      setVerificationResult(result);
    } catch (err: any) {
      console.error('Error verifying collection:', err);
      setError(err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };
  
  // Get verification status based on result
  const getVerificationStatus = (): VerificationStatus => {
    if (!verificationResult) return VerificationStatus.UNVERIFIED;
    
    if (verificationResult.status === 'success' && verificationResult.data?.isValid) {
      return VerificationStatus.VERIFIED;
    }
    
    if (verificationResult.status === 'error') {
      return VerificationStatus.FAILED;
    }
    
    return VerificationStatus.UNVERIFIED;
  };
  
  // View collection details
  const viewCollection = () => {
    if (verificationResult?.data?.collectionId) {
      navigate(`/collections/${verificationResult.data.collectionId}`);
    }
  };
  
  return (
    <div className="verification-page">
      <div className="page-header">
        <h1>Verify Collection</h1>
        <p>Verify the authenticity of a collection inscription</p>
      </div>
      
      <div className="verification-container">
        <div className="verification-form-container">
          <form onSubmit={handleSubmit} className="verification-form">
            <div className="form-group">
              <label htmlFor="inscription-id">Inscription ID</label>
              <input
                id="inscription-id"
                type="text"
                value={inscriptionId}
                onChange={handleInscriptionIdChange}
                placeholder="Enter inscription ID"
                className="form-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="collection-id">Collection ID</label>
              <input
                id="collection-id"
                type="text"
                value={collectionId}
                onChange={handleCollectionIdChange}
                placeholder="Enter collection ID"
                className="form-input"
              />
            </div>
            
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={verifying}
              className="verify-button"
            >
              {verifying ? 'Verifying...' : 'Verify Collection'}
            </button>
          </form>
        </div>
        
        {verificationResult && (
          <div className="verification-result">
            <h2>Verification Result</h2>
            
            <div className="result-status">
              <CollectionVerificationBadge 
                status={getVerificationStatus()} 
                inscriptionId={verificationResult.data?.inscriptionId}
                showDetails
                className="result-badge"
              />
              
              {verificationResult.data?.collectionId && (
                <button 
                  onClick={viewCollection}
                  className="view-collection-button"
                >
                  View Collection
                </button>
              )}
            </div>
            
            <CollectionVerificationDetails
              status={getVerificationStatus()}
              inscriptionId={verificationResult.data?.inscriptionId}
              collectionId={verificationResult.data?.collectionId || collectionId}
              verifiedAt={verificationResult.data?.verifiedAt}
              onChainData={verificationResult.data?.inscriptionId ? {
                inscriptionNumber: parseInt(verificationResult.data.inscriptionId.split('i')[1]),
                timestamp: verificationResult.data.verifiedAt,
                block: 0, // This would come from the API
                transactionId: '' // This would come from the API
              } : undefined}
            />
            
            <div className="verification-message">
              <p>{verificationResult.message || 'Verification completed.'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionVerificationPage;
