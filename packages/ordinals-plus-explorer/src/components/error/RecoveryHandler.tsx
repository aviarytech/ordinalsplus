import React, { useState, useEffect, useCallback } from 'react';
import { InscriptionError } from '../../types/error';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface RecoveryHandlerProps {
  error: InscriptionError;
  onRetry?: () => Promise<void>;
  onCancel?: () => void;
  maxRetries?: number;
  initialDelay?: number;
  children?: React.ReactNode;
}

/**
 * Component that handles recovery from errors, with auto-retry capability
 */
const RecoveryHandler: React.FC<RecoveryHandlerProps> = ({
  error,
  onRetry,
  onCancel,
  maxRetries = 3,
  initialDelay = 1000,
  children
}) => {
  const { addToast } = useToast();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelay, setRetryDelay] = useState(initialDelay);
  const [autoRetry, setAutoRetry] = useState(error.recoverable && retryCount < maxRetries);
  
  // Get recovery suggestions based on error
  const suggestions = getSuggestionsForError(error);

  // Handle manual retry
  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      await onRetry();
      // If we're here, the retry was successful
      addToast('Operation completed successfully after retry', 'success');
    } catch (retryError) {
      const nextDelay = retryDelay * 1.5;
      setRetryDelay(nextDelay);
      
      addToast(`Retry failed: ${(retryError as Error).message}`, 'error');
      
      // Check if we should auto-retry
      if (retryCount < maxRetries && error.recoverable) {
        // Schedule next retry with increasing delay
        setTimeout(() => {
          handleRetry();
        }, nextDelay);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [onRetry, retryCount, maxRetries, error.recoverable, retryDelay, addToast]);

  // Auto-retry on component mount if applicable
  useEffect(() => {
    let timeoutId: number | undefined;
    
    if (autoRetry && onRetry && !isRetrying) {
      timeoutId = window.setTimeout(() => {
        handleRetry();
      }, retryDelay);
    }
    
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [autoRetry, onRetry, handleRetry, retryDelay, isRetrying]);

  return (
    <div className="border rounded-md p-4 shadow-sm bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
        </div>
        
        <div className="ml-3 w-full">
          <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Error Recovery
          </h3>
          
          <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
            <p>An error occurred: {error.message}</p>
            
            {suggestions.length > 0 && (
              <div className="mt-3">
                <p className="font-medium">Suggestions:</p>
                <ul className="list-disc list-inside text-sm mt-1 space-y-1">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="mt-4 flex gap-3">
            {onRetry && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-800/60 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="-ml-0.5 mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCw className="-ml-0.5 mr-1.5 h-4 w-4" aria-hidden="true" />
                    Retry {retryCount > 0 ? `(${retryCount}/${maxRetries})` : ''}
                  </>
                )}
              </button>
            )}
            
            {autoRetry && (
              <button
                type="button"
                onClick={() => setAutoRetry(false)}
                className="inline-flex items-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel Auto-Retry
              </button>
            )}
            
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
      
      {children}
    </div>
  );
};

/**
 * Get recovery suggestions based on error type
 */
function getSuggestionsForError(error: InscriptionError): string[] {
  if (!error.recoverable) {
    return ['This error cannot be recovered automatically. Please try again.'];
  }
  
  if (error.suggestion) {
    return [error.suggestion];
  }
  
  // Generic suggestions based on error category
  switch (error.category) {
    case 'NETWORK':
      return [
        'Check your internet connection',
        'Wait a moment and try again',
        'The server might be temporarily unavailable'
      ];
    case 'WALLET':
      return [
        'Make sure your wallet is connected',
        'Check that you have sufficient funds',
        'Try reconnecting your wallet'
      ];
    case 'VALIDATION':
      return [
        'Review the input values and correct any errors',
        'Make sure all required fields are filled properly'
      ];
    case 'TRANSACTION':
      return [
        'The transaction may need more time to be confirmed',
        'Try using a higher fee rate if the transaction is being rejected',
        'Check your wallet for any pending transactions'
      ];
    default:
      return [
        'Try the operation again',
        'If the problem persists, try refreshing the page'
      ];
  }
}

export default RecoveryHandler; 