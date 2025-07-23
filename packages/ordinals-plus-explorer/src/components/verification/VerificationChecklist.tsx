/**
 * Verification Checklist Component
 * 
 * This component displays individual verification checks with auto-verification,
 * enhanced animations, and prominent visual feedback for verified items.
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/**
 * Represents a single verification check result
 */
export interface VerificationCheck {
  /** Unique identifier for the check */
  id: string;
  /** Display name of the check */
  name: string;
  /** Category of the check (signature, expiration, content, etc.) */
  category: 'signature' | 'expiration' | 'content' | 'revocation' | 'other' | 'ordinals+';
  /** Whether the check passed */
  passed: boolean;
  /** Explanation of the check result */
  explanation: string;
  /** Technical details (optional) */
  details?: string;
  /** Whether the check is currently being verified */
  loading?: boolean;
  /** Verification timestamp */
  verifiedAt?: Date;
}

interface VerificationChecklistProps {
  /** List of verification checks to display */
  checks: VerificationCheck[];
  /** Whether to group checks by category */
  groupByCategory?: boolean;
  /** Custom class name */
  className?: string;
  /** Whether to auto-verify checks on mount */
  autoVerify?: boolean;
  /** Whether to show verification progress */
  showProgress?: boolean;
  /** Callback when verification completes */
  onVerificationComplete?: (results: VerificationCheck[]) => void;
}

/**
 * Component for displaying an enhanced list of verification checks with auto-verification
 */
export const VerificationChecklist: React.FC<VerificationChecklistProps> = ({
  checks,
  groupByCategory = true,
  className = '',
  autoVerify = true,
  showProgress = true,
  onVerificationComplete
}) => {
  const [verificationState, setVerificationState] = useState<Record<string, VerificationCheck>>({});
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [completedChecks, setCompletedChecks] = useState(new Set<string>());
  
  // Refs to prevent infinite loops
  const hasInitialized = useRef(false);
  const hasStartedVerification = useRef(false);
  const onVerificationCompleteRef = useRef(onVerificationComplete);
  const lastChecksString = useRef('');

  // Update the ref when callback changes
  useEffect(() => {
    onVerificationCompleteRef.current = onVerificationComplete;
  }, [onVerificationComplete]);

  // Memoize checks to prevent unnecessary re-initialization
  const memoizedChecks = useMemo(() => checks, [JSON.stringify(checks.map(c => ({ id: c.id, name: c.name, passed: c.passed, explanation: c.explanation })))]);

  // Initialize verification state only when checks actually change (not just array reference)
  useEffect(() => {
    const checksString = JSON.stringify(memoizedChecks.map(c => ({ id: c.id, name: c.name, passed: c.passed })));
    
    // Only reinitialize if the checks content actually changed
    if (checksString === lastChecksString.current) {
      return;
    }
    
    lastChecksString.current = checksString;
    
    // If auto-verify is enabled, start checks in unverified state
    // If auto-verify is disabled, show the actual state immediately
    const initialState = memoizedChecks.reduce((acc, check) => {
      if (autoVerify) {
        // For auto-verify, start in neutral/unverified state
        acc[check.id] = { 
          ...check, 
          loading: false,
          // Don't show the final passed/failed state initially - start neutral
          passed: false, // This will be updated during verification
          explanation: 'Pending verification...'
        };
      } else {
        // For manual verify, show the actual state
        acc[check.id] = { ...check, loading: false };
      }
      return acc;
    }, {} as Record<string, VerificationCheck>);
    
    setVerificationState(initialState);
    hasInitialized.current = true;
    hasStartedVerification.current = false; // Reset verification flag when checks actually change
    setCompletedChecks(new Set());
    setVerificationProgress(0);
  }, [memoizedChecks, autoVerify]);

  // Auto-verification logic - fixed to prevent loops
  const performAutoVerification = useCallback(async () => {
    if (!autoVerify || memoizedChecks.length === 0 || hasStartedVerification.current) {
      return;
    }
    
    hasStartedVerification.current = true;
    setIsVerifying(true);
    setVerificationProgress(0);
    setCompletedChecks(new Set());

    // Simulate verification process with realistic timing
    for (let i = 0; i < memoizedChecks.length; i++) {
      const check = memoizedChecks[i];
      
      // Update check to loading state
      setVerificationState(prev => ({
        ...prev,
        [check.id]: { ...prev[check.id], loading: true }
      }));

      // Simulate verification delay (realistic timing based on check type)
      const delay = check.category === 'signature' ? 300 : 
                   check.category === 'ordinals+' ? 400 :
                   check.category === 'content' ? 250 : 200;
      
      await new Promise(resolve => setTimeout(resolve, delay));

      // Complete verification
      const now = new Date();
      const originalCheck = memoizedChecks[i]; // Get the original check with correct passed/failed state
      setVerificationState(prev => ({
        ...prev,
        [check.id]: {
          ...originalCheck, // Use original check data
          loading: false,
          verifiedAt: now
        }
      }));

      setCompletedChecks(prev => new Set([...prev, check.id]));
      setVerificationProgress(((i + 1) / memoizedChecks.length) * 100);
    }

    setIsVerifying(false);
    
    // Call completion callback using the ref
    if (onVerificationCompleteRef.current) {
      const finalResults = memoizedChecks.map(check => ({
        ...check,
        verifiedAt: new Date()
      }));
      onVerificationCompleteRef.current(finalResults);
    }
  }, [memoizedChecks, autoVerify]); // Use memoized checks

  // Start auto-verification on mount - only once per checks change
  useEffect(() => {
    if (autoVerify && memoizedChecks.length > 0 && hasInitialized.current && !hasStartedVerification.current) {
      // Small delay to allow UI to render
      const timer = setTimeout(() => {
        performAutoVerification();
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [autoVerify, memoizedChecks.length, performAutoVerification]);

  // Group checks by category if requested
  const groupedChecks = useMemo(() => {
    const currentChecks = Object.values(verificationState);
    if (!groupByCategory) return { all: currentChecks };
    
    return currentChecks.reduce((groups, check) => {
      const category = check.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(check);
      return groups;
    }, {} as Record<string, VerificationCheck[]>);
  }, [verificationState, groupByCategory]);

  // Get category display name and icon
  const getCategoryInfo = (category: string): { name: string; icon: string } => {
    switch (category) {
      case 'signature': 
        return { 
          name: 'Signature Verification', 
          icon: '🔐' 
        };
      case 'expiration': 
        return { 
          name: 'Expiration Checks', 
          icon: '⏰' 
        };
      case 'content': 
        return { 
          name: 'Content Verification', 
          icon: '📄' 
        };
      case 'revocation': 
        return { 
          name: 'Revocation Status', 
          icon: '🚫' 
        };
      case 'ordinals+': 
        return { 
          name: 'Ordinals+ Verification', 
          icon: '⚡' 
        };
      case 'other': 
        return { 
          name: 'Other Checks', 
          icon: '📋' 
        };
      default: 
        return { 
          name: category.charAt(0).toUpperCase() + category.slice(1), 
          icon: '✓' 
        };
    }
  };

  // Render verification progress bar
  const renderProgressBar = () => {
    if (!showProgress || !isVerifying) return null;

    return (
      <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Verification Progress
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(verificationProgress)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${verificationProgress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Verifying checks... This may take a few moments.
        </div>
      </div>
    );
  };

  // Render a single check item with enhanced visuals
  const renderCheckItem = (check: VerificationCheck) => {
    const isCompleted = completedChecks.has(check.id);
    const isLoading = check.loading;
    
    return (
      <div 
        key={check.id}
        className={`
          verification-check-item relative overflow-hidden
          transition-all duration-500 ease-out transform
          ${isCompleted ? 'scale-[1.01]' : ''}
          ${isLoading ? 'bg-blue-50 border-blue-200' : ''}
          ${check.passed && isCompleted ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : ''}
          ${!check.passed && isCompleted ? 'bg-gradient-to-r from-red-50 to-pink-50 border-red-200' : ''}
          ${!isLoading && !isCompleted ? 'bg-gray-50 border-gray-200' : ''}
          border-l-4 p-4 mb-3 rounded-r-lg shadow-sm hover:shadow-md
        `}
        data-testid={`verification-check-${check.id}`}
      >
        {/* Animated background shimmer for loading */}
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
        )}

        <div className="flex items-start space-x-4 relative z-10">
          {/* Status Icon */}
          <div className="flex-shrink-0 mt-1">
            {isLoading ? (
              <div className="relative">
                <svg className="h-6 w-6 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : isCompleted ? (
              // Only show pass/fail icons for completed checks
              check.passed ? (
                <div className="relative">
                  <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )
            ) : (
              // Pending/unverified state - show clock icon
              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </div>
          
          {/* Check Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4 className={`
                text-sm font-semibold transition-colors duration-300
                ${check.passed && isCompleted ? 'text-green-800' : ''}
                ${!check.passed && isCompleted ? 'text-red-800' : ''}
                ${isLoading ? 'text-blue-700' : ''}
                ${!isLoading && !isCompleted ? 'text-gray-700' : ''}
              `}>
                {check.name}
              </h4>
              
              {/* Timestamp for completed checks */}
              {check.verifiedAt && isCompleted && (
                <span className="text-xs text-gray-400 ml-2">
                  {check.verifiedAt.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            <p className={`
              text-xs mt-1 transition-colors duration-300
              ${check.passed && isCompleted ? 'text-green-700' : ''}
              ${!check.passed && isCompleted ? 'text-red-700' : ''}
              ${isLoading ? 'text-blue-600' : ''}
              ${!isLoading && !isCompleted ? 'text-gray-600' : ''}
            `}>
              {isLoading ? 'Verifying...' : check.explanation}
            </p>
            
            {/* Technical Details (if available) */}
            {check.details && !isLoading && (
              <details className="mt-2 group">
                <summary className="text-xs text-indigo-600 cursor-pointer hover:text-indigo-800 transition-colors">
                  Technical details
                </summary>
                <div className="mt-2 p-3 bg-gray-800 rounded-md text-xs text-green-400 font-mono whitespace-pre-wrap border border-gray-700">
                  {check.details}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`verification-checklist w-full max-w-none overflow-hidden ${className}`}>
      {/* Progress Bar */}
      {renderProgressBar()}
      
      {groupByCategory ? (
        // Render checks grouped by category
        Object.entries(groupedChecks).map(([category, categoryChecks]) => {
          const categoryInfo = getCategoryInfo(category);
          return (
            <div key={category} className="verification-check-category mb-6 last:mb-0">
              <div className="flex items-center mb-4">
                <span className="text-2xl mr-3">{categoryInfo.icon}</span>
                <h3 className="text-lg font-semibold text-gray-800">
                  {categoryInfo.name}
                </h3>
              </div>
              <div className="space-y-0">
                {categoryChecks.map(renderCheckItem)}
              </div>
            </div>
          );
        })
      ) : (
        // Render all checks without grouping
        <div className="space-y-0">
          {Object.values(verificationState).map(renderCheckItem)}
        </div>
      )}
      
      {/* Show message if no checks are available */}
      {checks.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No verification checks available</h3>
          <p className="mt-1 text-sm text-gray-500">
            There are no verification checks to display for this inscription.
          </p>
        </div>
      )}
    </div>
  );
};

export default VerificationChecklist;
