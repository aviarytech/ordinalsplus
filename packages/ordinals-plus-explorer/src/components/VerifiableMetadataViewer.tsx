/**
 * Verifiable Metadata Viewer
 * 
 * Component for displaying and verifying inscription metadata as Verifiable Credentials
 */
import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Eye, EyeOff, FileText, Key, Link2 } from 'lucide-react';
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
  /** Whether to show only verification (no metadata info) */
  verificationOnly?: boolean;
  /** Callback when verification completes */
  onVerificationComplete?: (result: any) => void;
  /** Expected sat number for validation (extracted from inscription data) */
  expectedSatNumber?: string;
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
 * Check if metadata contains a DID Document structure
 */
const isDIDDocument = (metadata: any): boolean => {
  if (!metadata || typeof metadata !== 'object') {
    return false;
  }
  
  // Check for DID Document fields according to W3C DID Core spec
  return (
    metadata['@context'] &&
    metadata.id &&
    typeof metadata.id === 'string' &&
    metadata.id.startsWith('did:') &&
    (metadata.verificationMethod || metadata.authentication || metadata.assertionMethod || metadata.service)
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
 * Get a brief description of the DID document
 */
const getDIDDocumentInfo = (metadata: any) => {
  const methods = (metadata.verificationMethod || []).length;
  const services = (metadata.service || []).length;
  const capabilities = [];
  
  if (metadata.authentication) capabilities.push('Authentication');
  if (metadata.assertionMethod) capabilities.push('Assertion');
  if (metadata.keyAgreement) capabilities.push('Key Agreement');
  if (metadata.capabilityInvocation) capabilities.push('Capability Invocation');
  if (metadata.capabilityDelegation) capabilities.push('Capability Delegation');
  
  return {
    methods,
    services,
    capabilities
  };
};

/**
 * Component for viewing and verifying metadata as VCs
 */
export const VerifiableMetadataViewer: React.FC<VerifiableMetadataViewerProps> = ({
  inscriptionId,
  metadata,
  className = '',
  autoVerify = true,
  verificationOnly = false,
  onVerificationComplete,
  expectedSatNumber
}) => {
  const [showRawMetadata, setShowRawMetadata] = useState(false);
  const [verificationService, setVerificationService] = useState<VerificationService | null>(null);
  const { apiService } = useApi();
  
  const isVC = isVerifiableCredential(metadata);
  const isDID = isDIDDocument(metadata);
  
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
    <div className={`w-full ${className}`}>
      {isVC && verificationService ? (
        verificationOnly ? (
          // Verification only mode - just show the verification component
          <VerificationComponent
            inscriptionId={inscriptionId}
            verificationService={verificationService}
            autoVerify={autoVerify}
            showDetailedResults={true}
            inscriptionData={{ metadata }}
            className="w-full h-full"
            onVerificationComplete={onVerificationComplete}
            expectedSatNumber={expectedSatNumber}
          />
        ) : (
          // Full mode - show verification on left, metadata on right
          <div className="w-full">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
              {/* Left Column - Verification Component (Full Height) */}
              <div className="col-span-1">
                <VerificationComponent
                  inscriptionId={inscriptionId}
                  verificationService={verificationService}
                  autoVerify={autoVerify}
                  showDetailedResults={true}
                  inscriptionData={{ metadata }}
                  className="w-full h-full"
                  onVerificationComplete={onVerificationComplete}
                  expectedSatNumber={expectedSatNumber}
                />
              </div>

              {/* Right Column - All Metadata Information */}
              <div className="col-span-1 space-y-4">
                {/* Metadata Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Metadata:</span>
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-500" />
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                        Verifiable Credential
                      </span>
                      <span className="text-xs text-gray-500">
                        {getCredentialTypeDescription(metadata)}
                      </span>
                    </div>
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

                {/* VC Summary */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="space-y-3 text-sm">
                    {metadata.id && (
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">ID:</span>
                        <div className="text-blue-600 dark:text-blue-400 text-xs font-mono break-all mt-1">
                          {metadata.id}
                        </div>
                      </div>
                    )}
                    
                    {metadata.issuer && (
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">Issuer:</span>
                        <div className="text-blue-600 dark:text-blue-400 text-xs font-mono break-all mt-1">
                          {typeof metadata.issuer === 'string' ? metadata.issuer : metadata.issuer.id || 'Unknown'}
                        </div>
                      </div>
                    )}
                    
                    {metadata.issuanceDate && (
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">Issued:</span>
                        <div className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                          {new Date(metadata.issuanceDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                    
                    {metadata.expirationDate && (
                      <div>
                        <span className="font-medium text-blue-700 dark:text-blue-300">Expires:</span>
                        <div className="text-blue-600 dark:text-blue-400 text-xs mt-1">
                          {new Date(metadata.expirationDate).toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Raw Metadata Display */}
                {showRawMetadata && (
                  <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-40 overflow-y-auto">
                    {JSON.stringify(metadata, null, 2)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      ) : isDID ? (
        // DID Document display
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600 dark:text-gray-400">Metadata:</span>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-500" />
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                  DID Document
                </span>
              </div>
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

          {/* DID Document Summary */}
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
            <div className="space-y-3 text-sm">
              {/* DID ID */}
              <div>
                <span className="font-medium text-green-700 dark:text-green-300">DID:</span>
                <div className="text-green-600 dark:text-green-400 text-xs font-mono break-all mt-1">
                  {metadata.id}
                </div>
              </div>
              
              {/* DID Document Stats */}
              {(() => {
                const didInfo = getDIDDocumentInfo(metadata);
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {didInfo.methods > 0 && (
                      <div className="flex items-center gap-2">
                        <Key className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-green-700 dark:text-green-300 text-xs">
                          {didInfo.methods} Verification Method{didInfo.methods !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    
                    {didInfo.services > 0 && (
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-green-700 dark:text-green-300 text-xs">
                          {didInfo.services} Service{didInfo.services !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    
                    {didInfo.capabilities.length > 0 && (
                      <div className="col-span-full">
                        <span className="text-green-700 dark:text-green-300 text-xs font-medium">Capabilities: </span>
                        <span className="text-green-600 dark:text-green-400 text-xs">
                          {didInfo.capabilities.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
              
              {/* Context */}
              {metadata['@context'] && (
                <div>
                  <span className="font-medium text-green-700 dark:text-green-300">Context:</span>
                  <div className="text-green-600 dark:text-green-400 text-xs mt-1">
                    {Array.isArray(metadata['@context']) 
                      ? metadata['@context'].join(', ') 
                      : metadata['@context']}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Raw Metadata Display */}
          {showRawMetadata && (
            <div className="p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-40 overflow-y-auto">
              {JSON.stringify(metadata, null, 2)}
            </div>
          )}
        </div>
      ) : (
        // Other metadata types
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600 dark:text-gray-400">Metadata:</span>
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                <span className="text-gray-600 dark:text-gray-400">
                  Not a Verifiable Credential - displaying raw metadata
                </span>
              </div>
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

          {/* Raw Metadata Display */}
          {showRawMetadata && (
            <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-40 overflow-y-auto">
              {JSON.stringify(metadata, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VerifiableMetadataViewer;
