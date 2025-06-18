/**
 * Verification Component
 * 
 * This is the main component that integrates all verification UI elements
 * and handles the verification flow with automatic verification.
 */
import React, { useState, useEffect } from 'react';
import { VerificationService } from '../../services/verificationService';
import { VerificationStatus, VerificationResult } from '../../types/verification';
import VerifyButton from './VerifyButton';
import StatusBadge from './StatusBadge';
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
  /** Whether to show manual verify controls */
  showVerifyControls?: boolean;
  /** Optional inscription data if already available */
  inscriptionData?: {
    contentBase64?: string;
    contentType?: string;
    metadata?: any;
  };
  /** Callback when verification completes */
  onVerificationComplete?: (result: VerificationResult) => void;
  /** Expected sat number for validation (extracted from inscription data) */
  expectedSatNumber?: string;
}

/**
 * Main component for verification functionality
 */
export const VerificationComponent: React.FC<VerificationComponentProps> = ({
  inscriptionId,
  verificationService,
  className = '',
  autoVerify = true,
  showDetailedResults = true,
  showVerifyControls = false,
  inscriptionData,
  onVerificationComplete,
  expectedSatNumber
}) => {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if we have data that can be verified
  const hasVerifiableData = inscriptionData && (
    inscriptionData.contentBase64 || 
    inscriptionData.metadata
  );

  // Verify the inscription
  const verifyInscription = async (id: string) => {
    setLoading(true);
    try {
      let verificationResult: VerificationResult;
      
      if (hasVerifiableData) {
        // Use the provided inscription data directly
        verificationResult = await verificationService.verifyInscriptionData(inscriptionData, id);
      } else {
        // This will result in an error since verifyInscription requires data
        // We'll create a helpful error message instead
        verificationResult = {
          status: VerificationStatus.ERROR,
          message: 'Inscription data not available - cannot verify without fetching data first',
          error: new Error('Inscription data required for verification')
        };
      }
      
      setResult(verificationResult);
      if (onVerificationComplete) {
        onVerificationComplete(verificationResult);
      }
    } catch (error) {
      const errorResult = {
        status: VerificationStatus.ERROR,
        message: `Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error : new Error(String(error))
      };
      setResult(errorResult);
      if (onVerificationComplete) {
        onVerificationComplete(errorResult);
      }
    } finally {
      setLoading(false);
    }
  };

  // Auto-verify on mount if enabled
  useEffect(() => {
    if (autoVerify && hasVerifiableData) {
      verifyInscription(inscriptionId);
    }
  }, [inscriptionId, autoVerify, hasVerifiableData]);

  // Show loading state immediately for auto-verification
  if (autoVerify && loading && !result) {
    return (
      <div className={`verification-container ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm text-gray-600">Verifying inscription...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`verification-container ${className}`}>
      {/* Verification Controls - Only show if explicitly enabled */}
      {showVerifyControls && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-700">Verification</h3>
          
          {!result || result.status === VerificationStatus.ERROR ? (
            <VerifyButton
              inscriptionId={inscriptionId}
              onVerify={verifyInscription}
              status={result?.status}
              disabled={loading || !hasVerifiableData}
            />
          ) : (
            <button
              type="button"
              onClick={() => verifyInscription(inscriptionId)}
              className="text-xs text-indigo-600 hover:text-indigo-800"
              disabled={loading || !hasVerifiableData}
            >
              Verify Again
            </button>
          )}
        </div>
      )}
      
      {/* Warning if no inscription data and auto-verify is disabled */}
      {!hasVerifiableData && !autoVerify && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            Inscription data not available - verification disabled
          </p>
        </div>
      )}
      
      {/* Verification Status Badge - Only show for manual verification */}
      {!autoVerify && (loading || result) && (
        <div className="mb-4">
          <StatusBadge
            status={loading ? VerificationStatus.LOADING : result!.status}
            message={result?.message}
            size="md"
          />
        </div>
      )}
      
      {/* Detailed Verification Results - Always show and always expanded for auto-verification */}
      {result && !loading && (
        <VerificationDetailsPanel
          result={result}
          defaultExpanded={true} // Always expanded
          className="mb-4"
          expectedSatNumber={expectedSatNumber}
        />
      )}
      
      {/* Error Message - Only show if detailed results are not shown */}
      {result?.status === VerificationStatus.ERROR && result.error && !showDetailedResults && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">
            {result.error.message}
          </p>
        </div>
      )}
      
      {/* No inscription data message for auto-verification */}
      {autoVerify && !hasVerifiableData && !loading && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
          <div className="flex items-center">
            <svg className="h-5 w-5 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-gray-600">
              No inscription data available for verification
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerificationComponent;
