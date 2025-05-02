import React, { useState } from 'react';
import { FileText, Fingerprint, Link2 } from 'lucide-react';
import ResourceCreationForm from '../components/create/ResourceCreationForm';
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

type CreateTab = 'generic' | 'did' | 'resource';

const CreatePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CreateTab>('generic');

  const renderActiveForm = () => {
    switch (activeTab) {
      case 'generic':
        return <ResourceCreationForm />;
      // case 'did':
      //   return <DidCreationForm />;
      // case 'resource':
      //   return <LinkedResourceForm />;
      default:
        return null;
    }
  };

  const TabButton: React.FC<{ tabId: CreateTab; activeTab: CreateTab; onClick: (tabId: CreateTab) => void; icon: React.ElementType; label: string }> = 
    ({ tabId, activeTab, onClick, icon: Icon, label }) => (
    <button
      onClick={() => onClick(tabId)}
      className={`flex items-center justify-center px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors duration-150 focus:outline-none 
                  ${activeTab === tabId 
                    ? 'border-orange-500 text-orange-600 dark:text-orange-400' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'}`}
    >
      <Icon className="w-4 h-4 mr-2" />
      {label}
    </button>
  );

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {renderActiveForm()}
    </div>
  );
};

export default CreatePage; 