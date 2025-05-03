import React from 'react';
import { AlertCircle, AlertTriangle, XCircle, Info, Undo, RotateCcw } from 'lucide-react';
import { InscriptionError, ErrorSeverity, ErrorCategory } from '../../types/error';

interface ErrorDisplayProps {
  error: Error | InscriptionError;
  onRetry?: () => void;
  onDismiss?: () => void;
  onRecoveryAction?: () => void;
  variant?: 'inline' | 'modal' | 'full-page';
  showDetails?: boolean;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  onRecoveryAction,
  variant = 'inline',
  showDetails = false,
}) => {
  // Determine if this is our structured error or a generic one
  const isInscriptionError = 'code' in error && 'category' in error && 'severity' in error;
  
  // Default for generic errors
  let severity = ErrorSeverity.ERROR;
  let category = ErrorCategory.GENERAL;
  let code = 'UNKNOWN_ERROR';
  let recoverable = false;
  let suggestion = '';
  
  // Extract properties if it's our structured error
  if (isInscriptionError) {
    const inscriptionError = error as InscriptionError;
    severity = inscriptionError.severity;
    category = inscriptionError.category;
    code = inscriptionError.code;
    recoverable = inscriptionError.recoverable || false;
    suggestion = inscriptionError.suggestion || '';
  }
  
  // Determine icon based on severity
  const getIcon = () => {
    switch (severity) {
      case ErrorSeverity.INFO:
        return <Info className="h-6 w-6 text-blue-500" aria-hidden="true" />;
      case ErrorSeverity.WARNING:
        return <AlertTriangle className="h-6 w-6 text-amber-500" aria-hidden="true" />;
      case ErrorSeverity.ERROR:
        return <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />;
      case ErrorSeverity.CRITICAL:
        return <XCircle className="h-6 w-6 text-red-600" aria-hidden="true" />;
      default:
        return <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />;
    }
  };
  
  // Determine background color based on severity
  const getBgColor = () => {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700';
      case ErrorSeverity.WARNING:
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700';
      case ErrorSeverity.ERROR:
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
      case ErrorSeverity.CRITICAL:
        return 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-800';
      default:
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700';
    }
  };
  
  // Determine text color based on severity
  const getTextColor = () => {
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'text-blue-800 dark:text-blue-200';
      case ErrorSeverity.WARNING:
        return 'text-amber-800 dark:text-amber-200';
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        return 'text-red-800 dark:text-red-200';
      default:
        return 'text-red-800 dark:text-red-200';
    }
  };
  
  // Get appropriate container classes based on variant
  const getContainerClasses = () => {
    const baseClasses = `border rounded-md shadow-sm ${getBgColor()} ${getTextColor()}`;
    
    switch (variant) {
      case 'inline':
        return `${baseClasses} p-4`;
      case 'modal':
        return `${baseClasses} p-6 max-w-md w-full mx-auto`;
      case 'full-page':
        return `${baseClasses} p-8 max-w-2xl w-full mx-auto mt-16`;
      default:
        return `${baseClasses} p-4`;
    }
  };
  
  // Get error title based on severity
  const getErrorTitle = () => {
    if (isInscriptionError && 'userMessage' in error && typeof error.userMessage === 'string' && error.userMessage) {
      return error.userMessage;
    }
    
    switch (severity) {
      case ErrorSeverity.INFO:
        return 'Information';
      case ErrorSeverity.WARNING:
        return 'Warning';
      case ErrorSeverity.ERROR:
        return 'Error Occurred';
      case ErrorSeverity.CRITICAL:
        return 'Critical Error';
      default:
        return 'Error Occurred';
    }
  };
  
  // Handle safely converting any properties to string for display
  const safeStringify = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return value.toString();
    
    try {
      return JSON.stringify(value);
    } catch (e) {
      return '[Complex Object]';
    }
  };
  
  // Format timestamp properly
  const formatTimestamp = (timestamp: unknown): string => {
    if (typeof timestamp === 'number') {
      return new Date(timestamp).toLocaleString();
    }
    if (typeof timestamp === 'string') {
      return new Date(timestamp).toLocaleString();
    }
    return '[Invalid Timestamp]';
  };
  
  return (
    <div className={getContainerClasses()} role="alert">
      <div className="flex items-start">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="ml-3 w-full">
          <h3 className="text-sm font-medium">{getErrorTitle()}</h3>
          <div className="mt-2 text-sm">
            <p>{error.message}</p>
            
            {suggestion && (
              <p className="mt-2 font-medium">
                Suggestion: {suggestion}
              </p>
            )}
            
            {showDetails && isInscriptionError && (
              <div className="mt-3 p-2 bg-black/5 dark:bg-white/5 rounded text-xs overflow-auto">
                <p><strong>Error Code:</strong> {code}</p>
                <p><strong>Category:</strong> {category}</p>
                <p><strong>Severity:</strong> {severity}</p>
                {isInscriptionError && 'details' in error && error.details && (
                  <p><strong>Details:</strong> {safeStringify(error.details)}</p>
                )}
                {isInscriptionError && 'timestamp' in error && error.timestamp && (
                  <p><strong>Time:</strong> {formatTimestamp(error.timestamp)}</p>
                )}
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          {(onRetry || onDismiss || (recoverable && onRecoveryAction)) && (
            <div className="mt-4 flex gap-3">
              {recoverable && onRecoveryAction && (
                <button
                  type="button"
                  onClick={onRecoveryAction}
                  className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-900/30 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/60 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  <RotateCcw className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                  Recover
                </button>
              )}
              
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/30 px-3 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <Undo className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                  Retry
                </button>
              )}
              
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="inline-flex items-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Dismiss
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Modal variant for blocking errors
export const ErrorModal: React.FC<Omit<ErrorDisplayProps, 'variant'>> = (props) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full">
        <ErrorDisplay {...props} variant="modal" />
      </div>
    </div>
  );
};

export default ErrorDisplay; 