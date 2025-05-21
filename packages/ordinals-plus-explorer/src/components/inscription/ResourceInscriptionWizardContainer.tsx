import React from 'react';
import ResourceInscriptionWizard, { useResourceInscription } from './ResourceInscriptionWizard';
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
 * ResourceInscriptionWizardContainer is the main container component that integrates all the steps
 * of the resource inscription wizard into a cohesive flow.
 */
interface ResourceInscriptionWizardContainerProps {
  initialContentType?: string;
  initialContent?: string;
}

const ResourceInscriptionWizardContainer: React.FC<ResourceInscriptionWizardContainerProps> = ({ initialContentType, initialContent }) => {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Resource Inscription Wizard
        </h1>

        <ResourceInscriptionWizard initialContentType={initialContentType} initialContent={initialContent}>
          <WizardContent />
        </ResourceInscriptionWizard>
      </div>
    </div>
  );
};

export default ResourceInscriptionWizardContainer;
