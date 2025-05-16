/**
 * Verification Component
 * 
 * This is the main component that integrates all verification UI elements
 * and handles the verification flow.
 */
import React, { useState, useEffect } from 'react';
import { VerificationService } from '../../services/verificationService';
import { VerificationStatus, VerificationResult } from '../../types/verification';
import VerifyButton from './VerifyButton';
import StatusBadge from './StatusBadge';
import CredentialDetails from './CredentialDetails';
import VerificationDetailsPanel from './VerificationDetailsPanel';

interface VerificationComponentProps {
  /** The ID of the inscription to verify */
  inscriptionId: string;
  /** Verification service instance */
  verificationService: VerificationService;
  /** Custom class name */
  className?: string;
  /** Whether to auto-verify on mount */
  autoVerify?: boolean;
  /** Whether to show detailed results by default */
  showDetailedResults?: boolean;
}

/**
 * Main component for verification functionality
 */
export const VerificationComponent: React.FC<VerificationComponentProps> = ({
  inscriptionId,
  verificationService,
  className = '',
  autoVerify = false,
  showDetailedResults = true
}) => {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(autoVerify);

  // Verify the inscription
  const verifyInscription = async (id: string) => {
    setLoading(true);
    try {
      const verificationResult = await verificationService.verifyInscription(id);
      setResult(verificationResult);
    } catch (error) {
      setResult({
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error(String(error))
      });
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify on mount if enabled
  useEffect(() => {
    if (autoVerify) {
      verifyInscription(inscriptionId);
    }
  }, [inscriptionId, autoVerify]);

  return (
    <div className={`verification-container ${className}`}>
      {/* Verification Controls */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">Verification</h3>
        
        {!result || result.status === VerificationStatus.ERROR ? (
          <VerifyButton
            inscriptionId={inscriptionId}
            onVerify={verifyInscription}
            status={result?.status}
            disabled={loading}
          />
        ) : (
          <button
            type="button"
            onClick={() => verifyInscription(inscriptionId)}
            className="text-xs text-indigo-600 hover:text-indigo-800"
            disabled={loading}
          >
            Verify Again
          </button>
        )}
      </div>
      
      {/* Verification Status */}
      {(loading || result) && (
        <div className="mb-4">
          <StatusBadge
            status={loading ? VerificationStatus.LOADING : result!.status}
            message={result?.message}
            size="md"
          />
        </div>
      )}
      
      {/* Detailed Verification Results */}
      {showDetailedResults && result && !loading && (
        <VerificationDetailsPanel
          result={result}
          defaultExpanded={result.status === VerificationStatus.VALID || result.status === VerificationStatus.INVALID}
          className="mt-4 mb-4"
        />
      )}
      
      {/* Credential Details (only shown for valid credentials) */}
      {result?.status === VerificationStatus.VALID && result.credential && (
        <CredentialDetails
          credential={result.credential}
          issuer={result.issuer}
          defaultExpanded={!showDetailedResults} // Only auto-expand if detailed results are not shown
          className="mt-4"
        />
      )}
      
      {/* Error Message */}
      {result?.status === VerificationStatus.ERROR && result.error && !showDetailedResults && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            {result.error.message}
          </p>
        </div>
      )}
    </div>
  );
};

export default VerificationComponent;
