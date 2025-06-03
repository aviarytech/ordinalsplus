import React from 'react';
import { useResourceInscription, WIZARD_STEPS } from './ResourceInscriptionWizard';
import StepIndicator from '../ui/StepIndicator';
import UTXOSelectionStep from './UTXOSelectionStep';
import ContentSelectionStep from './ContentSelectionStep';
import MetadataStep from './MetadataStep';
import TransactionStep from './TransactionStep';
import CompletionStep from './CompletionStep';

/**
 * WizardContent renders the appropriate step component based on the current step in the wizard.
 */
const WizardContent: React.FC = () => {
  const { state } = useResourceInscription();
  
  // Render the appropriate step component based on the current step
  switch (state.currentStep) {
    case 0:
      return <UTXOSelectionStep />;
    case 1:
      return <ContentSelectionStep />;
    case 2:
      return <MetadataStep />;
    case 3:
      return <TransactionStep />;
    case 4:
      return <CompletionStep />;
    default:
      return <UTXOSelectionStep />;
  }
};

/**
 * WizardLayout component that provides the step indicator and error display
 */
const WizardLayout: React.FC = () => {
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
        <WizardContent />
      </div>
    </div>
  );
};

/**
 * ResourceInscriptionWizardContainer is the main container component that integrates all the steps
 * of the resource inscription wizard into a cohesive flow.
 * Note: This component expects to be wrapped in a ResourceInscriptionProvider.
 */
const ResourceInscriptionWizardContainer: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Resource Inscription Wizard
        </h1>
        
        <WizardLayout />
      </div>
    </div>
  );
};

export default ResourceInscriptionWizardContainer;
