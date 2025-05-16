import React from 'react';
import './CollectionVerificationBadge.css';

export enum VerificationStatus {
  VERIFIED = 'verified',
  PENDING = 'pending',
  UNVERIFIED = 'unverified',
  FAILED = 'failed'
}

interface CollectionVerificationBadgeProps {
  status: VerificationStatus;
  inscriptionId?: string;
  showDetails?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * A badge component that displays the verification status of a collection
 */
const CollectionVerificationBadge: React.FC<CollectionVerificationBadgeProps> = ({
  status,
  inscriptionId,
  showDetails = false,
  onClick,
  className = ''
}) => {
  const getStatusIcon = () => {
    switch (status) {
      case VerificationStatus.VERIFIED:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="verification-icon verified">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
          </svg>
        );
      case VerificationStatus.PENDING:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="verification-icon pending">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 000-1.5h-3.75V6z" clipRule="evenodd" />
          </svg>
        );
      case VerificationStatus.FAILED:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="verification-icon failed">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="verification-icon unverified">
            <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm11.378-3.917c-.89-.777-2.366-.777-3.255 0a.75.75 0 01-.988-1.129c1.454-1.272 3.776-1.272 5.23 0 1.513 1.324 1.513 3.518 0 4.842a3.75 3.75 0 01-.837.552c-.676.328-1.028.774-1.028 1.152v.75a.75.75 0 01-1.5 0v-.75c0-1.279 1.06-2.107 1.875-2.502.182-.088.351-.199.503-.331.83-.727.83-1.857 0-2.584zM12 18a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const getStatusText = () => {
    switch (status) {
      case VerificationStatus.VERIFIED:
        return 'Verified On-chain';
      case VerificationStatus.PENDING:
        return 'Verification Pending';
      case VerificationStatus.FAILED:
        return 'Verification Failed';
      default:
        return 'Not Verified';
    }
  };

  return (
    <div 
      className={`collection-verification-badge ${status} ${className} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      {getStatusIcon()}
      <span className="status-text">{getStatusText()}</span>
      
      {showDetails && inscriptionId && status === VerificationStatus.VERIFIED && (
        <div className="verification-details">
          <span className="detail-label">Inscription ID:</span>
          <a 
            href={`/inscriptions/${inscriptionId}`} 
            className="inscription-link"
            onClick={(e) => e.stopPropagation()}
          >
            {inscriptionId.substring(0, 8)}...
          </a>
        </div>
      )}
    </div>
  );
};

export default CollectionVerificationBadge;
