import React from 'react';
import ResourceInscriptionWizardContainer from '../components/inscription/ResourceInscriptionWizardContainer';

const CreateHtmlPage: React.FC = () => {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Create HTML Inscription
        </h1>
        <ResourceInscriptionWizardContainer initialContentType="text/html" />
      </div>
    </div>
  );
};

export default CreateHtmlPage;
