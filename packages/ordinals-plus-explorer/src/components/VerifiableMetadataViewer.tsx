/**
 * Verifiable Metadata Viewer
 * 
 * Component for displaying and verifying inscription metadata as Verifiable Credentials
 */
import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { VerificationService } from '../services/verificationService';
import { useApi } from '../context/ApiContext';
import { VerificationComponent } from './verification';

interface VerifiableMetadataViewerProps {
  /** The inscription ID for reference */
  inscriptionId: string;
  /** The metadata to analyze and potentially verify */
  metadata: any;
  /** Custom class name */
  className?: string;
  /** Whether to auto-verify if VC is detected */
  autoVerify?: boolean;
}

/**
 * Check if metadata contains a Verifiable Credential structure
 * The VC properties should be at the top level of the metadata object
 */
const isVerifiableCredential = (metadata: any): boolean => {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  
  // Check for required VC fields according to W3C VC spec at top level
  return (
    metadata['@context'] &&
    metadata.type &&
    (Array.isArray(metadata.type) ? metadata.type.includes('VerifiableCredential') : metadata.type === 'VerifiableCredential') &&
    metadata.issuer &&
    metadata.credentialSubject
  );
};

/**
 * Get a brief description of the credential type
 */
const getCredentialTypeDescription = (metadata: any): string => {
  if (!metadata?.type) return 'Unknown type';
  
  const types = Array.isArray(metadata.type) ? metadata.type : [metadata.type];
  const nonVcTypes = types.filter((t: string) => t !== 'VerifiableCredential');
  
  if (nonVcTypes.length > 0) {
    return nonVcTypes.join(', ');
  }
  
  return 'Verifiable Credential';
};

/**
 * Component for viewing and verifying metadata as VCs
 */
export const VerifiableMetadataViewer: React.FC<VerifiableMetadataViewerProps> = ({
  inscriptionId,
  metadata,
  className = '',
  autoVerify = false
}) => {
  const [showRawMetadata, setShowRawMetadata] = useState(false);
  const [verificationService, setVerificationService] = useState<VerificationService | null>(null);
  const { apiService } = useApi();
  
  const isVC = isVerifiableCredential(metadata);
  
  // Initialize verification service
  useEffect(() => {
    if (apiService && isVC) {
      const service = new VerificationService(apiService);
      setVerificationService(service);
    }
  }, [apiService, isVC]);

  if (!metadata) {
    return (
      <div className={`${className}`}>
        <span className="text-gray-500 text-xs">No metadata available</span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-600 dark:text-gray-400">Metadata:</span>
          {isVC && (
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                Verifiable Credential
              </span>
              <span className="text-xs text-gray-500">
                {getCredentialTypeDescription(metadata)}
              </span>
            </div>
          )}
        </div>
        
        <button
          onClick={() => setShowRawMetadata(!showRawMetadata)}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {showRawMetadata ? (
            <>
              <EyeOff className="w-3 h-3" />
              Hide Raw
            </>
          ) : (
            <>
              <Eye className="w-3 h-3" />
              Show Raw
            </>
          )}
        </button>
      </div>

      {isVC && verificationService ? (
        <div className="space-y-3">
          {/* VC Summary */}
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {metadata.id && (
                <div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">ID:</span>
                  <div className="text-blue-600 dark:text-blue-400 text-xs font-mono break-all">
                    {metadata.id}
                  </div>
                </div>
              )}
              
              {metadata.issuer && (
                <div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">Issuer:</span>
                  <div className="text-blue-600 dark:text-blue-400 text-xs font-mono break-all">
                    {typeof metadata.issuer === 'string' ? metadata.issuer : metadata.issuer.id || 'Unknown'}
                  </div>
                </div>
              )}
              
              {metadata.issuanceDate && (
                <div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">Issued:</span>
                  <div className="text-blue-600 dark:text-blue-400 text-xs">
                    {new Date(metadata.issuanceDate).toLocaleDateString()}
                  </div>
                </div>
              )}
              
              {metadata.expirationDate && (
                <div>
                  <span className="font-medium text-blue-700 dark:text-blue-300">Expires:</span>
                  <div className="text-blue-600 dark:text-blue-400 text-xs">
                    {new Date(metadata.expirationDate).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Verification Component */}
          <VerificationComponent
            inscriptionId={inscriptionId}
            verificationService={verificationService}
            autoVerify={autoVerify}
            showDetailedResults={true}
            inscriptionData={{ metadata }}
            className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-800"
          />
        </div>
      ) : (
        <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
          <AlertTriangle className="w-4 h-4 text-yellow-500" />
          <span className="text-gray-600 dark:text-gray-400">
            Not a Verifiable Credential - displaying raw metadata
          </span>
        </div>
      )}

      {/* Raw Metadata Display */}
      {showRawMetadata && (
        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-40 overflow-y-auto">
          {JSON.stringify(metadata, null, 2)}
        </div>
      )}
    </div>
  );
};

export default VerifiableMetadataViewer;
