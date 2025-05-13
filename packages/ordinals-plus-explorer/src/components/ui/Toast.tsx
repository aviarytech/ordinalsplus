import React, { useEffect, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { ErrorSeverity } from '../../types/error';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  id: string;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({
  id,
  message,
  type = 'info',
  duration = 5000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) {
          onClose(id);
        }
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [duration, id, onClose]);
  
  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose(id);
    }
  };
  
  if (!isVisible) return null;
  
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };
  
  const getClasses = () => {
    const baseClasses = 'rounded-md border p-4 shadow-md animate-slide-in dark:shadow-md';
    
    switch (type) {
      case 'success':
        return `${baseClasses} bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-800 dark:text-green-200`;
      case 'error':
        return `${baseClasses} bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-800 dark:text-red-200`;
      case 'warning':
        return `${baseClasses} bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200`;
      case 'info':
      default:
        return `${baseClasses} bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200`;
    }
  };
  
  return (
    <div className={getClasses()}>
      <div className="flex">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="ml-3 flex-grow">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              type="button"
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                type === 'success'
                  ? 'text-green-500 hover:bg-green-100 focus:ring-green-500'
                  : type === 'error'
                  ? 'text-red-500 hover:bg-red-100 focus:ring-red-500'
                  : type === 'warning'
                  ? 'text-amber-500 hover:bg-amber-100 focus:ring-amber-500'
                  : 'text-blue-500 hover:bg-blue-100 focus:ring-blue-500'
              }`}
              onClick={handleClose}
            >
              <span className="sr-only">Dismiss</span>
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;

/**
 * ToastContainer component to display multiple toasts
 */
export const ToastContainer: React.FC<{
  toasts: ToastProps[];
  onClose: (id: string) => void;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxToasts?: number;
}> = ({
  toasts,
  onClose,
  position = 'top-right',
  maxToasts = 5,
}) => {
  // Only show a limited number of toasts
  const visibleToasts = toasts.slice(0, maxToasts);
  
  // Position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
  };
  
  return (
    <div className={`fixed z-50 flex flex-col gap-2 ${positionClasses[position]}`}>
      {visibleToasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
};

/**
 * Helper function to convert error severity to toast type
 */
export function severityToToastType(severity: ErrorSeverity): ToastType {
  switch (severity) {
    case ErrorSeverity.INFO:
      return 'info';
    case ErrorSeverity.WARNING:
      return 'warning';
    case ErrorSeverity.ERROR:
    case ErrorSeverity.CRITICAL:
      return 'error';
    default:
      return 'info';
  }
}

/**
 * Add global animation for slide-in effect to your global CSS or tailwind.config.js:
 * 
 * @keyframes slide-in {
 *   from {
 *     transform: translateX(100%);
 *     opacity: 0;
 *   }
 *   to {
 *     transform: translateX(0);
 *     opacity: 1;
 *   }
 * }
 * 
 * .animate-slide-in {
 *   animation: slide-in 0.3s ease-out;
 * }
 */ 