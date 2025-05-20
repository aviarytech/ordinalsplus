/**
 * Credential Details Component
 * 
 * This component displays detailed information about a verified credential
 * in an expandable panel.
 */
import React, { useState } from 'react';
import type { VerifiableCredential } from '../../types/verification';
import { IssuerInfo } from '../../types/verification';

interface CredentialDetailsProps {
  /** The verified credential to display */
  credential: VerifiableCredential;
  /** Information about the issuer */
  issuer?: IssuerInfo;
  /** Whether the panel should start expanded */
  defaultExpanded?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Formats a date string for display
 */
const formatDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown';
  
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (error) {
    return dateString;
  }
};

/**
 * Component for displaying detailed credential information
 */
export const CredentialDetails: React.FC<CredentialDetailsProps> = ({
  credential,
  issuer,
  defaultExpanded = false,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Get subject from credential
  const subject = Array.isArray(credential.credentialSubject)
    ? credential.credentialSubject[0]
    : credential.credentialSubject;

  // Toggle expanded state
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`border border-gray-200 rounded-lg overflow-hidden ${className}`}>
      {/* Header */}
      <div 
        className="bg-gray-50 px-4 py-3 flex justify-between items-center cursor-pointer"
        onClick={toggleExpanded}
      >
        <h3 className="text-sm font-medium text-gray-900">
          Credential Details
        </h3>
        <button
          type="button"
          className="text-gray-500 hover:text-gray-700"
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        >
          <svg
            className={`h-5 w-5 transition-transform ${isExpanded ? 'transform rotate-180' : ''}`}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Content (conditionally rendered) */}
      {isExpanded && (
        <div className="px-4 py-3 bg-white">
          {/* Issuer Information */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Issuer
            </h4>
            <div className="flex items-center">
              {issuer?.avatar && (
                <img
                  src={issuer.avatar}
                  alt={issuer.name || 'Issuer'}
                  className="h-8 w-8 rounded-full mr-2"
                />
              )}
              <div>
                {issuer?.name && (
                  <p className="text-sm font-medium text-gray-900">{issuer.name}</p>
                )}
                <p className="text-xs text-gray-500">
                  {typeof credential.issuer === 'string' 
                    ? credential.issuer 
                    : credential.issuer.id}
                </p>
              </div>
            </div>
            {issuer?.url && (
              <a
                href={issuer.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 mt-1 inline-block"
              >
                Visit issuer website
              </a>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Issuance Date
              </h4>
              <p className="text-sm text-gray-900">
                {formatDate(credential.issuanceDate)}
              </p>
            </div>
            {credential.expirationDate && (
              <div>
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                  Expiration Date
                </h4>
                <p className="text-sm text-gray-900">
                  {formatDate(credential.expirationDate)}
                </p>
              </div>
            )}
          </div>

          {/* Subject Information */}
          <div className="mb-4">
            <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Subject
            </h4>
            
            {subject.title && (
              <div className="mb-2">
                <h5 className="text-xs text-gray-500 mb-1">Title</h5>
                <p className="text-sm text-gray-900">{subject.title}</p>
              </div>
            )}
            
            {subject.description && (
              <div className="mb-2">
                <h5 className="text-xs text-gray-500 mb-1">Description</h5>
                <p className="text-sm text-gray-900">{subject.description}</p>
              </div>
            )}
            
            {subject.creator && (
              <div className="mb-2">
                <h5 className="text-xs text-gray-500 mb-1">Creator</h5>
                <p className="text-sm text-gray-900">{subject.creator}</p>
              </div>
            )}
            
            {subject.creationDate && (
              <div className="mb-2">
                <h5 className="text-xs text-gray-500 mb-1">Creation Date</h5>
                <p className="text-sm text-gray-900">{formatDate(subject.creationDate)}</p>
              </div>
            )}
            
            {/* Properties */}
            {subject.properties && Object.keys(subject.properties).length > 0 && (
              <div className="mt-3">
                <h5 className="text-xs font-medium text-gray-500 mb-2">Properties</h5>
                <div className="bg-gray-50 p-2 rounded-md">
                  {Object.entries(subject.properties).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 text-xs">
                      <span className="text-gray-500">{key}</span>
                      <span className="text-gray-900 font-medium">
                        {typeof value === 'object' 
                          ? JSON.stringify(value) 
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Credential ID */}
          {credential.id && (
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Credential ID
              </h4>
              <p className="text-xs text-gray-500 break-all">
                {credential.id}
              </p>
            </div>
          )}

          {/* View Raw JSON button */}
          <div className="mt-4 text-right">
            <button
              type="button"
              onClick={() => {
                const jsonString = JSON.stringify(credential, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                window.open(url);
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              View Raw JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredentialDetails;
