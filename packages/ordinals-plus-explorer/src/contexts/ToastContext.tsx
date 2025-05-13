import React, { createContext, useContext, useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ToastContainer, ToastProps, ToastType, severityToToastType } from '../components/ui/Toast';
import { InscriptionError, ErrorSeverity } from '../types/error';

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => string;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  addErrorToast: (error: Error | InscriptionError, duration?: number) => string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 5000): string => {
    const id = uuidv4();
    setToasts((prevToasts) => [...prevToasts, { id, message, type, duration }]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const addErrorToast = useCallback((error: Error | InscriptionError, duration = 5000): string => {
    let message = error.message || 'An unknown error occurred';
    let type: ToastType = 'error';
    
    // Check if it's an InscriptionError with severity
    if ('severity' in error && error.severity !== undefined) {
      type = severityToToastType(error.severity as ErrorSeverity);
      
      // For InscriptionError, we might have a user-friendly message
      if ('userMessage' in error && typeof error.userMessage === 'string' && error.userMessage) {
        message = error.userMessage;
      }
    }
    
    return addToast(message, type, duration);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast, clearToasts, addErrorToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}; 