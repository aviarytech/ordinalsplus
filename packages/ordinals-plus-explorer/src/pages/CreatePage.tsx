import React from 'react';
import ResourceInscriptionWizardContainer from '../components/inscription/ResourceInscriptionWizardContainer';
// import GenericOrdinalForm from '../components/create/GenericOrdinalForm';
// import DidCreationForm from '../components/create/DidCreationForm';
// import LinkedResourceForm from '../components/create/LinkedResourceForm';

// Placeholder form is no longer needed if all tabs are implemented
// const PlaceholderForm: React.FC<{ title: string }> = ({ title }) => (
//   <div className="p-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
//     <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">{title} Form</h3>
//     <p className="text-sm text-gray-500 dark:text-gray-500">Implementation coming soon...</p>
//   </div>
// );

const CreatePage: React.FC = () => {

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Create Ordinal Inscription
        </h1>
        <ResourceInscriptionWizardContainer />
      </div>
    </div>
  );
};

export default CreatePage; 