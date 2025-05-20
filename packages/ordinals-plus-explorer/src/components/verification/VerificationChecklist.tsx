/**
 * Verification Checklist Component
 * 
 * This component displays individual verification checks with pass/fail status
 * and explanations for each check.
 */
import React from 'react';

/**
 * Represents a single verification check result
 */
export interface VerificationCheck {
  /** Unique identifier for the check */
  id: string;
  /** Display name of the check */
  name: string;
  /** Category of the check (signature, expiration, content, etc.) */
  category: 'signature' | 'expiration' | 'content' | 'revocation' | 'other';
  /** Whether the check passed */
  passed: boolean;
  /** Explanation of the check result */
  explanation: string;
  /** Technical details (optional) */
  details?: string;
}

interface VerificationChecklistProps {
  /** List of verification checks to display */
  checks: VerificationCheck[];
  /** Whether to group checks by category */
  groupByCategory?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Component for displaying a list of verification checks
 */
export const VerificationChecklist: React.FC<VerificationChecklistProps> = ({
  checks,
  groupByCategory = true,
  className = ''
}) => {
  // Group checks by category if requested
  const groupedChecks = React.useMemo(() => {
    if (!groupByCategory) return { all: checks };
    
    return checks.reduce((groups, check) => {
      const category = check.category;
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(check);
      return groups;
    }, {} as Record<string, VerificationCheck[]>);
  }, [checks, groupByCategory]);

  // Get category display name
  const getCategoryName = (category: string): string => {
    switch (category) {
      case 'signature': return 'Signature Verification';
      case 'expiration': return 'Expiration Checks';
      case 'content': return 'Content Verification';
      case 'revocation': return 'Revocation Status';
      case 'other': return 'Other Checks';
      default: return category.charAt(0).toUpperCase() + category.slice(1);
    }
  };

  // Render a single check item
  const renderCheckItem = (check: VerificationCheck) => (
    <div 
      key={check.id}
      className="verification-check-item flex items-start p-2 border-b border-gray-100 last:border-b-0"
      data-testid={`verification-check-${check.id}`}
    >
      {/* Status Icon */}
      <div className="flex-shrink-0 mt-0.5">
        {check.passed ? (
          <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      
      {/* Check Content */}
      <div className="ml-3 flex-1">
        <h4 className="text-sm font-medium text-gray-900">{check.name}</h4>
        <p className="text-xs text-gray-600 mt-1">{check.explanation}</p>
        
        {/* Technical Details (if available) */}
        {check.details && (
          <details className="mt-1">
            <summary className="text-xs text-indigo-600 cursor-pointer">
              Technical details
            </summary>
            <div className="mt-1 p-2 bg-gray-50 rounded text-xs text-gray-700 font-mono whitespace-pre-wrap">
              {check.details}
            </div>
          </details>
        )}
      </div>
    </div>
  );

  return (
    <div className={`verification-checklist ${className}`}>
      {groupByCategory ? (
        // Render checks grouped by category
        Object.entries(groupedChecks).map(([category, categoryChecks]) => (
          <div key={category} className="verification-check-category mb-4 last:mb-0">
            <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              {getCategoryName(category)}
            </h3>
            <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
              {categoryChecks.map(renderCheckItem)}
            </div>
          </div>
        ))
      ) : (
        // Render all checks without grouping
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
          {checks.map(renderCheckItem)}
        </div>
      )}
      
      {/* Show message if no checks are available */}
      {checks.length === 0 && (
        <div className="text-sm text-gray-500 italic p-4 text-center">
          No verification checks available
        </div>
      )}
    </div>
  );
};

export default VerificationChecklist;
