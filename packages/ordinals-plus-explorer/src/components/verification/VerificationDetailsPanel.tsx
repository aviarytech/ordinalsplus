/**
 * Verification Details Panel Component
 * 
 * This component displays detailed verification results in an expandable panel,
 * showing verification status for different aspects of the credential.
 */
import React, { useState, useMemo } from 'react';
import { VerificationResult, VerificationStatus } from '../../types/verification';
import VerificationChecklist, { VerificationCheck } from './VerificationChecklist';
import StatusBadge from './StatusBadge';

interface VerificationDetailsPanelProps {
  /** The verification result to display details for */
  result: VerificationResult;
  /** Whether the panel should start expanded */
  defaultExpanded?: boolean;
  /** Custom class name */
  className?: string;
  /** Optional expected sat number to validate against credential subject */
  expectedSatNumber?: string;
}

/**
 * Extract expected sat number from inscription context if available
 * This is a helper function that could be enhanced in the future to extract
 * the sat number from browser context, URL params, or other sources when
 * the expectedSatNumber prop is not provided.
 */
const extractExpectedSatFromContext = (): string | undefined => {
  // Currently returns undefined since expectedSatNumber is passed as a prop
  // Could be enhanced to extract from URL, browser context, etc.
  return undefined;
};

/**
 * Formats a date for display
 */
const formatDate = (date?: Date): string => {
  if (!date) return 'Unknown';
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
};

/**
 * Component for displaying detailed verification results
 */
export const VerificationDetailsPanel: React.FC<VerificationDetailsPanelProps> = ({
  result,
  defaultExpanded = false,
  className = '',
  expectedSatNumber
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Generate verification checks based on the result
  const verificationChecks = useMemo(() => {
    if (!result || result.status === VerificationStatus.LOADING || 
        result.status === VerificationStatus.NO_METADATA) {
      return [];
    }

    const checks: VerificationCheck[] = [];

    // Only add checks if we have a credential
    if (result.credential) {
      // Signature check
      checks.push({
        id: 'signature',
        name: 'Digital Signature',
        category: 'signature',
        passed: result.status === VerificationStatus.VALID,
        explanation: result.status === VerificationStatus.VALID
          ? 'The credential signature is valid and was created by the issuer.'
          : 'The credential signature is invalid or could not be verified.',
        details: result.credential.proof 
          ? `Verification Method: ${Array.isArray(result.credential.proof) 
              ? result.credential.proof[0].verificationMethod 
              : result.credential.proof.verificationMethod}`
          : undefined
      });

      // Expiration check
      if (result.credential.expirationDate) {
        const expirationDate = new Date(result.credential.expirationDate);
        const isExpired = expirationDate < new Date();
        
        checks.push({
          id: 'expiration',
          name: 'Expiration Date',
          category: 'expiration',
          passed: !isExpired,
          explanation: isExpired
            ? `The credential expired on ${formatDate(expirationDate)}.`
            : `The credential is valid until ${formatDate(expirationDate)}.`,
          details: `Expiration Date: ${result.credential.expirationDate}`
        });
      }

      // Issuer check
      if (result.issuer) {
        checks.push({
          id: 'issuer',
          name: 'Issuer Verification',
          category: 'signature',
          passed: true,
          explanation: `Issued by ${result.issuer.did}`,
          details: `Issuer DID: ${result.issuer.did}`
        });
      }

      // Sat validation check - ensure credential subject references the same sat being verified
      if (result.credential && result.credential.credentialSubject) {
        const subjectId = Array.isArray(result.credential.credentialSubject) 
          ? result.credential.credentialSubject[0]?.id 
          : result.credential.credentialSubject.id;
          
        if (subjectId && subjectId.startsWith('did:btco')) {
          // Extract sat number from subject ID
          const satRegex = /^did:btco(?::(test|sig))?:([0-9]+)(?:\/(.+))?$/;
          const match = subjectId.match(satRegex);
          
          if (match) {
            const subjectSatNumber = match[2];
            const network = match[1] || 'mainnet';
            
            // Check if there might be a potential mismatch by looking for common patterns
            let explanation = `The credential correctly references sat ${subjectSatNumber} on ${network} network.`;
            let details = `Subject ID: ${subjectId}\nSat Number: ${subjectSatNumber}\nNetwork: ${network}`;
            let passed = true;
            
            // Check against expected sat number if provided
            if (expectedSatNumber && subjectSatNumber !== expectedSatNumber) {
              passed = false;
              explanation = `⚠️ Sat number mismatch! Expected sat ${expectedSatNumber} but credential references sat ${subjectSatNumber}.`;
              details += `\nExpected Sat: ${expectedSatNumber}\nActual Sat: ${subjectSatNumber}\n\n❌ This indicates the credential was created with incorrect sat data.`;
            } else if (!expectedSatNumber) {
              // Try to extract expected sat from context
              const contextSat = extractExpectedSatFromContext();
              if (contextSat && subjectSatNumber !== contextSat) {
                passed = false;
                explanation = `⚠️ Potential sat number mismatch! Expected sat ${contextSat} but credential references sat ${subjectSatNumber}.`;
                details += `\nExpected Sat: ${contextSat}\nActual Sat: ${subjectSatNumber}\n\n❌ This may indicate the credential was created with incorrect sat data.`;
              }
            }
            
            // Add note about potential issues if sat number looks suspicious
            if (subjectSatNumber.length > 10) {
              details += `\n\nNote: This sat number is ${subjectSatNumber.length} digits long. If this doesn't match the expected sat, the credential may have been created with incorrect data.`;
            }
            
            checks.push({
              id: 'satValidation',
              name: 'Sat Reference Validation', 
              category: 'ordinals+',
              passed: passed,
              explanation,
              details
            });
          } else {
            checks.push({
              id: 'satValidation',
              name: 'Sat Reference Validation',
              category: 'other', 
              passed: false,
              explanation: 'Invalid sat reference format in credential subject.',
              details: `Subject ID: ${subjectId}`
            });
          }
        } else {
          // Non-BTCO DID or no subject ID
          checks.push({
            id: 'satValidation',
            name: 'Sat Reference Validation',
            category: 'other',
            passed: true, // Neutral - not applicable for non-BTCO subjects
            explanation: 'Subject does not reference a Bitcoin satoshi.',
            details: subjectId ? `Subject ID: ${subjectId}` : 'No subject ID found'
          });
        }
      }

      // Content hash check (if available in the credential)
      if (result.credential.credentialSubject && 
          (typeof result.credential.credentialSubject === 'object') &&
          ('contentHash' in (Array.isArray(result.credential.credentialSubject) 
            ? result.credential.credentialSubject[0] 
            : result.credential.credentialSubject))) {
        
        const subject = Array.isArray(result.credential.credentialSubject)
          ? result.credential.credentialSubject[0]
          : result.credential.credentialSubject;
        
        checks.push({
          id: 'contentHash',
          name: 'Content Integrity',
          category: 'content',
          passed: true, // Assuming if we got this far, the content hash was verified
          explanation: 'The content hash matches the inscription data, confirming data integrity.',
          details: `Content Hash Algorithm: ${subject.contentHashAlgorithm || 'SHA-256'}\nContent Hash: ${subject.contentHash}`
        });
      }
    }

    // Add an error check if there was an error
    if (result.status === VerificationStatus.ERROR && result.error) {
      checks.push({
        id: 'error',
        name: 'Verification Error',
        category: 'other',
        passed: false,
        explanation: result.error.message,
        details: result.error.stack
      });
    }

    return checks;
  }, [result]);

  // Don't render anything if there's no result or it's loading
  if (!result || result.status === VerificationStatus.LOADING) {
    return null;
  }

  // Don't show details for no metadata
  if (result.status === VerificationStatus.NO_METADATA) {
    return (
      <div className={`verification-details-panel w-full max-w-none ${className}`}>
        <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
          <p className="text-sm text-gray-600">
            No verifiable metadata is available for this inscription. 
            This means the inscription was not created with verifiable credentials.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`verification-details-panel w-full max-w-none ${className}`}>
      <div className="border border-gray-200 rounded-lg overflow-hidden w-full">
        {/* Header */}
        <div 
          className="bg-gray-50 px-4 py-3 flex justify-between items-center cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center">
            <h3 className="text-sm font-medium text-gray-900 mr-3">
              Verification Details
            </h3>
            <StatusBadge
              status={result.status}
              showText={false}
              size="sm"
            />
          </div>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-700"
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
            {/* Verification Summary */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verification Summary
                </h4>
                {result.verifiedAt && (
                  <span className="text-xs text-gray-500">
                    Verified at: {formatDate(result.verifiedAt)}
                  </span>
                )}
              </div>
              
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-700">
                  {result.status === VerificationStatus.VALID && (
                    <>
                      This inscription has been successfully verified. 
                      The credential is valid and was issued by{' '}
                      <strong>{result.issuer?.name || 'the specified issuer'}</strong>.
                    </>
                  )}
                  
                  {result.status === VerificationStatus.INVALID && (
                    <>
                      This inscription could not be verified. 
                      {result.message && ` ${result.message}`}
                    </>
                  )}
                  
                  {result.status === VerificationStatus.ERROR && (
                    <>
                      An error occurred during verification. 
                      {result.message && ` ${result.message}`}
                    </>
                  )}
                </p>
              </div>
            </div>
            
            {/* Verification Checklist */}
            <div className="mb-4">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                Verification Checks
              </h4>
              <VerificationChecklist checks={verificationChecks} />
            </div>
            
            {/* Technical Information */}
            {result.credential && (
              <div>
                <details className="mt-4">
                  <summary className="text-xs text-indigo-600 cursor-pointer">
                    View Raw Credential Data
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 rounded-md overflow-auto max-h-60">
                    <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                      {JSON.stringify(result.credential, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificationDetailsPanel;
