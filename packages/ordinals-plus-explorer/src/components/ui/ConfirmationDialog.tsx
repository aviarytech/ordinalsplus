import React, { Fragment, useRef, useEffect } from 'react';
import { AlertTriangle, Info, X } from 'lucide-react';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'info' | 'danger';
  isLoading?: boolean;
  details?: React.ReactNode;
  showDetailsDefault?: boolean;
}

/**
 * A modal dialog component for confirming critical actions.
 * Provides different visual styles based on action type (warning, info, danger).
 */
const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'warning',
  isLoading = false,
  details,
  showDetailsDefault = false,
}) => {
  const [showDetails, setShowDetails] = React.useState(showDetailsDefault);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Color scheme based on dialog type
  const typeStyles = {
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-500" />,
      confirmButton: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
      header: 'bg-amber-50 dark:bg-amber-900/20',
      title: 'text-amber-700 dark:text-amber-400',
    },
    info: {
      icon: <Info className="h-6 w-6 text-blue-500" />,
      confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      header: 'bg-blue-50 dark:bg-blue-900/20',
      title: 'text-blue-700 dark:text-blue-400',
    },
    danger: {
      icon: <AlertTriangle className="h-6 w-6 text-red-500" />,
      confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      header: 'bg-red-50 dark:bg-red-900/20',
      title: 'text-red-700 dark:text-red-400',
    },
  };
  
  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);
  
  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      // Add slight delay to prevent immediate closure when opening
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Focus trap - keep focus within the dialog when open
  useEffect(() => {
    if (!isOpen) return;
    
    const dialog = dialogRef.current;
    if (!dialog) return;
    
    const focusableElements = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };
    
    dialog.addEventListener('keydown', handleTabKey);
    
    // Set initial focus to the first focusable element
    setTimeout(() => {
      firstElement?.focus();
    }, 100);
    
    return () => {
      dialog.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4 text-center">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black/50 transition-opacity" 
          aria-hidden="true"
        />
        
        {/* Dialog */}
        <div 
          ref={dialogRef}
          className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:max-w-lg"
        >
          {/* Header */}
          <div className={`px-4 pt-5 pb-4 sm:p-6 ${typeStyles[type].header}`}>
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full sm:mx-0 sm:h-10 sm:w-10">
                {typeStyles[type].icon}
              </div>
              <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left">
                <h3 
                  className={`text-lg font-medium leading-6 ${typeStyles[type].title}`}
                  id="modal-title"
                >
                  {title}
                </h3>
              </div>
              
              {/* Close button */}
              <button
                type="button"
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-4 pt-2 pb-4 sm:px-6">
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {typeof message === 'string' ? (
                <p>{message}</p>
              ) : (
                message
              )}
            </div>
            
            {/* Optional details section */}
            {details && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 dark:hover:text-indigo-300 focus:outline-none"
                >
                  {showDetails ? 'Hide details' : 'Show details'}
                </button>
                
                {showDetails && (
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded p-3 max-h-32 overflow-y-auto">
                    {details}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 bg-gray-50 dark:bg-gray-700">
            <button
              type="button"
              disabled={isLoading}
              onClick={onConfirm}
              className={`inline-flex w-full justify-center rounded-md px-3 py-2 text-sm font-semibold text-white shadow-sm sm:ml-3 sm:w-auto ${typeStyles[type].confirmButton} disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? 'Loading...' : confirmText}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-600 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-200 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500 sm:mt-0 sm:w-auto"
            >
              {cancelText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog; 