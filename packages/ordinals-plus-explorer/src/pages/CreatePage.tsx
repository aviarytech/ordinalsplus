import React from 'react';
import ResourceInscriptionWizardContainer from '../components/inscription/ResourceInscriptionWizardContainer';
import { ResourceInscriptionProvider } from '../components/inscription/ResourceInscriptionWizard';
import { CreateDidButton } from '../components/create';
// import DidCreationForm from '../components/create/DidCreationForm';
// import LinkedResourceForm from '../components/create/LinkedResourceForm';

// Placeholder form is no longer needed if all tabs are implemented
// const PlaceholderForm: React.FC<{ title: string }> = ({ title }) => (
//   <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
//     <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">{title} Form</h3>
//     <p className="text-sm text-gray-500 dark:text-gray-500">Implementation coming soon...</p>
//   </div>
// );

/**
 * Inner content component that has access to the ResourceInscription context
 */
const CreatePageContent: React.FC = () => {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Create Ordinal Inscription
          </h1>
          
          {/* Quick Create DID Button */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Quick Create:</span>
            <CreateDidButton 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onDidCreated={(did, privateKey) => {
                console.log('DID created:', did);
                console.log('Private key saved to file');
              }}
            />
          </div>
        </div>
        
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
            💡 Create a BTCO DID
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-400">
            Use the "Create DID" button above to instantly generate a decentralized identifier according to the BTCO DID specification. 
            This will automatically generate keys, create a DID document, and skip directly to the transaction signing step. 
            Your private key will be downloaded automatically for safekeeping.
          </p>
        </div>
        
        <ResourceInscriptionWizardContainer />
      </div>
    </div>
  );
};

/**
 * Main CreatePage component that provides the ResourceInscription context
 */
const CreatePage: React.FC = () => {
  return (
    <ResourceInscriptionProvider>
      <CreatePageContent />
    </ResourceInscriptionProvider>
  );
};

export default CreatePage; 