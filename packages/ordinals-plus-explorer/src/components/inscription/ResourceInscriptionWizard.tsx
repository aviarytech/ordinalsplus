import React, { createContext, useContext, useReducer, ReactNode, useCallback, useState } from 'react';
import StepIndicator, { Step } from '../ui/StepIndicator';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorDisplay from '../ui/ErrorDisplay';
import { validateStep, validateField, formatValidationErrors } from './validationUtils';

// Define the steps for the resource inscription process
export const WIZARD_STEPS: Step[] = [
  { id: 'utxo', label: 'UTXO Selection', description: 'Select funding source' },
  { id: 'content', label: 'Content', description: 'Configure resource content' },
  { id: 'metadata', label: 'Metadata', description: 'Add resource metadata' },
  { id: 'transaction', label: 'Transaction', description: 'Sign & broadcast' },
  { id: 'complete', label: 'Complete', description: 'View resource' },
];

// Define the state types
export interface UtxoSelection {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
  satNumber?: number;
}

export interface ContentData {
  type: string | null;
  content: string | null;
  preview: string | null;
}

export interface VerifiableCredential {
  provider: string | null;
  exchangeVariables: Record<string, any>;
  credential: any | null;
  exchangeData?: any | null;
}

export interface MetadataState {
  isVerifiableCredential: boolean;
  standard: Record<string, any>;
  verifiableCredential: VerifiableCredential;
}

export interface TransactionInfo {
  commitTx: string | null;
  revealTx: string | null;
  status: 'not_started' | 'preparing' | 'signing' | 'broadcasting' | 'confirming' | 'completed' | 'failed';
  error?: string;
  feeDetails?: {
    commitFeeRate: number;
    commitFee: number;
    commitVSize: number;
    revealFeeRate?: number;
    revealFee?: number;
    revealVSize?: number;
    totalFees: number;
  };
}

// Define the main state interface
export interface ResourceInscriptionState {
  currentStep: number;
  utxoSelection: UtxoSelection[]; // legacy, will be replaced
  inscriptionUtxo: UtxoSelection | null; // NEW: the UTXO to inscribe on
  fundingUtxos: UtxoSelection[];         // NEW: UTXOs to fund the transaction
  contentData: ContentData;
  metadata: MetadataState;
  transactionInfo: TransactionInfo;
  errors: Record<string, string>;
}

// Define the initial state
export const initialState: ResourceInscriptionState = {
  currentStep: 0,
  utxoSelection: [],
  inscriptionUtxo: null,
  fundingUtxos: [],
  contentData: {
    type: null,
    content: null,
    preview: null
  },
  metadata: {
    isVerifiableCredential: false,
    standard: {},
    verifiableCredential: {
      provider: null,
      exchangeVariables: {},
      credential: null
    }
  },
  transactionInfo: {
    commitTx: null,
    revealTx: null,
    status: 'not_started',
    feeDetails: undefined
  },
  errors: {}
};

// Define action types
export type ResourceInscriptionAction =
  | { type: 'SET_CURRENT_STEP'; payload: number }
  | { type: 'NEXT_STEP' }
  | { type: 'PREVIOUS_STEP' }
  | { type: 'SET_UTXO_SELECTION'; payload: UtxoSelection[] }
  | { type: 'SET_INSCRIPTION_UTXO'; payload: UtxoSelection | null }
  | { type: 'SET_FUNDING_UTXOS'; payload: UtxoSelection[] }
  | { type: 'SET_CONTENT_DATA'; payload: Partial<ContentData> }
  | { type: 'SET_METADATA'; payload: Partial<MetadataState> }
  | { type: 'SET_TRANSACTION_INFO'; payload: Partial<TransactionInfo> }
  | { type: 'SET_ERROR'; payload: { field: string; message: string } }
  | { type: 'CLEAR_ERROR'; payload: string }
  | { type: 'CLEAR_ALL_ERRORS' }
  | { type: 'RESET_STATE' };

// Create the reducer function
export const resourceInscriptionReducer = (
  state: ResourceInscriptionState,
  action: ResourceInscriptionAction
): ResourceInscriptionState => {
  switch (action.type) {
    case 'SET_CURRENT_STEP':
      return {
        ...state,
        currentStep: action.payload
      };
    case 'NEXT_STEP':
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, WIZARD_STEPS.length - 1)
      };
    case 'PREVIOUS_STEP':
      return {
        ...state,
        currentStep: Math.max(state.currentStep - 1, 0)
      };
    case 'SET_UTXO_SELECTION':
      return {
        ...state,
        utxoSelection: action.payload
      };
    case 'SET_INSCRIPTION_UTXO':
      return {
        ...state,
        inscriptionUtxo: action.payload
      };
    case 'SET_FUNDING_UTXOS':
      return {
        ...state,
        fundingUtxos: action.payload
      };
    case 'SET_CONTENT_DATA':
      return {
        ...state,
        contentData: {
          ...state.contentData,
          ...action.payload
        }
      };
    case 'SET_METADATA':
      return {
        ...state,
        metadata: {
          ...state.metadata,
          ...action.payload
        }
      };
    case 'SET_TRANSACTION_INFO':
      return {
        ...state,
        transactionInfo: {
          ...state.transactionInfo,
          ...action.payload
        }
      };
    case 'SET_ERROR':
      return {
        ...state,
        errors: {
          ...state.errors,
          [action.payload.field]: action.payload.message
        }
      };
    case 'CLEAR_ERROR':
      const newErrors = { ...state.errors };
      delete newErrors[action.payload];
      return {
        ...state,
        errors: newErrors
      };
    case 'CLEAR_ALL_ERRORS':
      return {
        ...state,
        errors: {}
      };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
};

// Create the context
interface ResourceInscriptionContextType {
  state: ResourceInscriptionState;
  dispatch: React.Dispatch<ResourceInscriptionAction>;
  goToStep: (step: number) => boolean;
  nextStep: () => boolean;
  previousStep: () => boolean;
  setUtxoSelection: (utxos: UtxoSelection[]) => void;
  setInscriptionUtxo: (utxo: UtxoSelection | null) => void;
  setFundingUtxos: (utxos: UtxoSelection[]) => void;
  setContentData: (data: Partial<ContentData>) => void;
  setMetadata: (data: Partial<MetadataState>) => void;
  setTransactionInfo: (info: Partial<TransactionInfo>) => void;
  setError: (field: string, message: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  resetState: () => void;
  validationErrors: Record<string, string>;
  validateFormField: (field: string, value: any) => boolean;
}

const ResourceInscriptionContext = createContext<ResourceInscriptionContextType | undefined>(undefined);

// Create the provider component
interface ResourceInscriptionProviderProps {
  children: ReactNode;
}

export const ResourceInscriptionProvider: React.FC<ResourceInscriptionProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(resourceInscriptionReducer, initialState);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Helper functions for common actions
  const goToStep = useCallback((step: number) => {
    // Validate current step before navigating
    const currentStepId = WIZARD_STEPS[state.currentStep]?.id;
    if (step > state.currentStep) {
      const validationResult = validateStep(currentStepId, state);
      if (!validationResult.valid) {
        setValidationErrors(formatValidationErrors(validationResult.errors));
        return false;
      }
    }
    
    dispatch({ type: 'SET_CURRENT_STEP', payload: step });
    return true;
  }, [state]);

  const nextStep = useCallback(() => {
    const currentStepId = WIZARD_STEPS[state.currentStep]?.id;
    const validationResult = validateStep(currentStepId, state);
    
    if (validationResult.valid) {
      dispatch({ type: 'NEXT_STEP' });
      return true;
    } else {
      setValidationErrors(formatValidationErrors(validationResult.errors));
      return false;
    }
  }, [state]);

  const previousStep = useCallback(() => {
    dispatch({ type: 'PREVIOUS_STEP' });
    return true;
  }, []);

  const setUtxoSelection = useCallback((utxos: UtxoSelection[]) => {
    dispatch({ type: 'SET_UTXO_SELECTION', payload: utxos });
    
    // Clear validation errors for UTXO selection
    if (validationErrors.utxoSelection) {
      const newErrors = { ...validationErrors };
      delete newErrors.utxoSelection;
      setValidationErrors(newErrors);
    }
  }, [validationErrors]);

  const setInscriptionUtxo = useCallback((utxo: UtxoSelection | null) => {
    dispatch({ type: 'SET_INSCRIPTION_UTXO', payload: utxo });
  }, []);

  const setFundingUtxos = useCallback((utxos: UtxoSelection[]) => {
    dispatch({ type: 'SET_FUNDING_UTXOS', payload: utxos });
  }, []);

  const setContentData = useCallback((data: Partial<ContentData>) => {
    dispatch({ type: 'SET_CONTENT_DATA', payload: data });
    
    // Validate content if it's being updated
    if (data.content !== undefined) {
      const errorMessage = validateField('content', data.content, {
        contentData: { ...state.contentData, ...data }
      });
      
      if (errorMessage) {
        setValidationErrors(prev => ({ ...prev, content: errorMessage }));
      } else if (validationErrors.content) {
        const newErrors = { ...validationErrors };
        delete newErrors.content;
        setValidationErrors(newErrors);
      }
    }
  }, [state.contentData, validationErrors]);

  const setMetadata = useCallback((data: Partial<MetadataState>) => {
    dispatch({ type: 'SET_METADATA', payload: data });
    
    // Clear relevant validation errors when metadata is updated
    const fieldsToCheck = ['title', 'description', 'vcProvider'];
    const newErrors = { ...validationErrors };
    let hasChanges = false;
    
    fieldsToCheck.forEach(field => {
      if (validationErrors[field]) {
        delete newErrors[field];
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      setValidationErrors(newErrors);
    }
  }, [validationErrors]);

  const setTransactionInfo = useCallback((info: Partial<TransactionInfo>) => {
    dispatch({ type: 'SET_TRANSACTION_INFO', payload: info });
  }, []);

  const setError = useCallback((field: string, message: string) => {
    dispatch({ type: 'SET_ERROR', payload: { field, message } });
    
    // Also add to validation errors
    setValidationErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const clearError = useCallback((field: string) => {
    dispatch({ type: 'CLEAR_ERROR', payload: field });
    
    // Also clear from validation errors
    if (validationErrors[field]) {
      const newErrors = { ...validationErrors };
      delete newErrors[field];
      setValidationErrors(newErrors);
    }
  }, [validationErrors]);

  const clearAllErrors = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_ERRORS' });
    setValidationErrors({});
  }, []);

  const resetState = useCallback(() => {
    dispatch({ type: 'RESET_STATE' });
    setValidationErrors({});
  }, []);
  
  // Validate a specific field
  const validateFormField = useCallback((field: string, value: any) => {
    const errorMessage = validateField(field, value, state);
    
    if (errorMessage) {
      setValidationErrors(prev => ({ ...prev, [field]: errorMessage }));
      return false;
    } else if (validationErrors[field]) {
      const newErrors = { ...validationErrors };
      delete newErrors[field];
      setValidationErrors(newErrors);
    }
    
    return true;
  }, [state, validationErrors]);

  const value = {
    state,
    dispatch,
    goToStep,
    nextStep,
    previousStep,
    setUtxoSelection,
    setInscriptionUtxo,
    setFundingUtxos,
    setContentData,
    setMetadata,
    setTransactionInfo,
    setError,
    clearError,
    clearAllErrors,
    resetState,
    validationErrors,
    validateFormField
  };

  return (
    <ResourceInscriptionContext.Provider value={value}>
      {children}
    </ResourceInscriptionContext.Provider>
  );
};

// Create a hook for using the context
export const useResourceInscription = () => {
  const context = useContext(ResourceInscriptionContext);
  if (context === undefined) {
    throw new Error('useResourceInscription must be used within a ResourceInscriptionProvider');
  }
  return context;
};

// Error fallback component
const ErrorFallback: React.FC<{ error: Error; resetErrorBoundary: () => void }> = ({ 
  error, 
  resetErrorBoundary 
}) => {
  return (
    <div className="p-4 border border-red-500 rounded-md bg-red-50 dark:bg-red-900/20">
      <ErrorDisplay 
        error={error}
        onRetry={resetErrorBoundary}
        showDetails={true}
      />
    </div>
  );
};

// Main wizard container component
interface ResourceInscriptionWizardProps {
  children: ReactNode;
}

const ResourceInscriptionWizard: React.FC<ResourceInscriptionWizardProps> = ({ children }) => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ResourceInscriptionProvider>
        <WizardLayout>
          {children}
        </WizardLayout>
      </ResourceInscriptionProvider>
    </ErrorBoundary>
  );
};

// Wizard layout component
const WizardLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { state, goToStep, validationErrors } = useResourceInscription();
  
  return (
    <div className="flex flex-col space-y-6">
      <div className="mb-6">
        <StepIndicator 
          steps={WIZARD_STEPS} 
          currentStepIndex={state.currentStep} 
          onStepClick={goToStep}
          allowNavigation={true}
        />
      </div>
      
      {/* Display global validation errors if any */}
      {Object.keys(validationErrors).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2">
            Please correct the following errors:
          </h3>
          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
            {Object.entries(validationErrors).map(([field, message]) => (
              <li key={field}>{message}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
};

export default ResourceInscriptionWizard;
