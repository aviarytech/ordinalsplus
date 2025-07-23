import React from 'react';
import { useResourceInscription, WIZARD_STEPS } from './ResourceInscriptionWizard';
import { useWallet } from '../../context/WalletContext';
import StepIndicator from '../ui/StepIndicator';
import UTXOSelectionStep from './UTXOSelectionStep';
import ContentSelectionStep from './ContentSelectionStep';
import MetadataStep from './MetadataStep';
import TransactionStep from './TransactionStep';
import CompletionStep from './CompletionStep';
import WalletConnector from '../WalletConnector';
import { Wallet, AlertCircle } from 'lucide-react';

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
 * WalletConnectionPrompt component that shows when wallet is not connected
 */
const WalletConnectionPrompt: React.FC = () => {
  const { hasUnisat, hasXverse, hasMagicEden, error } = useWallet();
  const hasAvailableWallets = hasUnisat || hasXverse || hasMagicEden;

  return (
    <div className="text-center py-12">
      <div className="max-w-md mx-auto">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
            <Wallet className="w-10 h-10 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Connect Your Wallet
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          You need to connect a Bitcoin wallet to create ordinal inscriptions. 
          Your wallet will be used to sign transactions and pay for inscription fees.
        </p>

        {hasAvailableWallets ? (
          <div className="space-y-4">
            <WalletConnector 
              buttonText="Connect Wallet"
              className="w-full"
            />
            
            {error && (
              <div className="flex items-center justify-center space-x-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center space-x-2 text-amber-600 dark:text-amber-400 mb-4">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">No Compatible Wallets Detected</span>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              To use the inscription wizard, you'll need to install a compatible Bitcoin wallet:
            </p>
            
            <div className="space-y-2 text-sm">
              <a 
                href="https://unisat.io/download" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">UniSat Wallet</div>
                <div className="text-gray-500 dark:text-gray-400">Download from unisat.io</div>
              </a>
              
              <a 
                href="https://www.xverse.app/download" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">Xverse Wallet</div>
                <div className="text-gray-500 dark:text-gray-400">Download from xverse.app</div>
              </a>
              
              <a 
                href="https://wallet.magiceden.io/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="font-medium text-gray-900 dark:text-gray-100">Magic Eden Wallet</div>
                <div className="text-gray-500 dark:text-gray-400">Download from magiceden.io</div>
              </a>
            </div>
            
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
              After installing a wallet, refresh this page to continue.
            </p>
          </div>
        )}
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
  const { connected, isConnecting } = useWallet();

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Resource Inscription Wizard
        </h1>
        
        {/* Show loading state while connecting */}
        {isConnecting ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-current"></div>
              <span>Connecting to wallet...</span>
            </div>
          </div>
        ) : connected ? (
          /* Show wizard when wallet is connected */
          <WizardLayout />
        ) : (
          /* Show connection prompt when wallet is not connected */
          <WalletConnectionPrompt />
        )}
      </div>
    </div>
  );
};

export default ResourceInscriptionWizardContainer;
