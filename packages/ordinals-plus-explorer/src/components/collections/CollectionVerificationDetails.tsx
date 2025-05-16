import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { VerificationStatus } from './CollectionVerificationBadge';

interface CollectionVerificationDetailsProps {
  status: VerificationStatus;
  inscriptionId?: string;
  collectionId: string;
  verifiedAt?: string;
  onChainData?: {
    inscriptionNumber?: number;
    timestamp?: string;
    block?: number;
    transactionId?: string;
  };
  className?: string;
}

/**
 * A component that displays detailed verification information for a collection
 */
const CollectionVerificationDetails: React.FC<CollectionVerificationDetailsProps> = ({
  status,
  inscriptionId,
  collectionId,
  verifiedAt,
  onChainData,
  className = ''
}) => {
  const [expanded, setExpanded] = useState(false);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const renderVerificationDetails = () => {
    switch (status) {
      case VerificationStatus.VERIFIED:
        return (
          <div className="verification-details-content">
            <h4>Verification Information</h4>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value verified">Verified On-chain</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Verified At:</span>
              <span className="detail-value">{formatDate(verifiedAt)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Collection ID:</span>
              <Link to={`/collections/${collectionId}`} className="detail-value link">
                {collectionId}
              </Link>
            </div>
            {inscriptionId && (
              <div className="detail-row">
                <span className="detail-label">Inscription ID:</span>
                <Link to={`/inscriptions/${inscriptionId}`} className="detail-value link">
                  {inscriptionId}
                </Link>
              </div>
            )}
            {onChainData && (
              <>
                <h4>On-chain Data</h4>
                {onChainData.inscriptionNumber !== undefined && (
                  <div className="detail-row">
                    <span className="detail-label">Inscription Number:</span>
                    <span className="detail-value">{onChainData.inscriptionNumber}</span>
                  </div>
                )}
                {onChainData.timestamp && (
                  <div className="detail-row">
                    <span className="detail-label">Timestamp:</span>
                    <span className="detail-value">{formatDate(onChainData.timestamp)}</span>
                  </div>
                )}
                {onChainData.block !== undefined && (
                  <div className="detail-row">
                    <span className="detail-label">Block:</span>
                    <span className="detail-value">{onChainData.block}</span>
                  </div>
                )}
                {onChainData.transactionId && (
                  <div className="detail-row">
                    <span className="detail-label">Transaction ID:</span>
                    <a 
                      href={`https://mempool.space/tx/${onChainData.transactionId}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="detail-value link"
                    >
                      {onChainData.transactionId.substring(0, 10)}...
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        );
      case VerificationStatus.PENDING:
        return (
          <div className="verification-details-content">
            <h4>Verification Status</h4>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value pending">Verification Pending</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Collection ID:</span>
              <Link to={`/collections/${collectionId}`} className="detail-value link">
                {collectionId}
              </Link>
            </div>
            <p className="verification-message">
              This collection's verification is currently being processed. 
              The verification process may take some time to complete.
            </p>
          </div>
        );
      case VerificationStatus.FAILED:
        return (
          <div className="verification-details-content">
            <h4>Verification Status</h4>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value failed">Verification Failed</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Collection ID:</span>
              <Link to={`/collections/${collectionId}`} className="detail-value link">
                {collectionId}
              </Link>
            </div>
            <p className="verification-message error">
              There was an issue verifying this collection. 
              The collection data may have been modified or the on-chain inscription may be invalid.
            </p>
          </div>
        );
      default:
        return (
          <div className="verification-details-content">
            <h4>Verification Status</h4>
            <div className="detail-row">
              <span className="detail-label">Status:</span>
              <span className="detail-value unverified">Not Verified</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Collection ID:</span>
              <Link to={`/collections/${collectionId}`} className="detail-value link">
                {collectionId}
              </Link>
            </div>
            <p className="verification-message">
              This collection has not been verified on-chain. 
              On-chain verification provides proof of authenticity and ownership.
            </p>
          </div>
        );
    }
  };

  return (
    <div className={`collection-verification-details ${className} ${expanded ? 'expanded' : 'collapsed'}`}>
      <button 
        className="toggle-details-button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
      >
        {expanded ? 'Hide Verification Details' : 'Show Verification Details'}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className={`toggle-icon ${expanded ? 'expanded' : ''}`}
        >
          <path fillRule="evenodd" d="M12.53 16.28a.75.75 0 01-1.06 0l-7.5-7.5a.75.75 0 011.06-1.06L12 14.69l6.97-6.97a.75.75 0 111.06 1.06l-7.5 7.5z" clipRule="evenodd" />
        </svg>
      </button>
      
      {expanded && renderVerificationDetails()}
    </div>
  );
};

export default CollectionVerificationDetails;
