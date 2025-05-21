import React, { useState } from 'react';
import HtmlCompositionForm from '../components/create/HtmlCompositionForm';
import ResourceInscriptionWizardContainer from '../components/inscription/ResourceInscriptionWizardContainer';

const CreateHtmlPage: React.FC = () => {
  const [step, setStep] = useState<'compose' | 'inscribe'>('compose');
  const [html, setHtml] = useState<string>('');

  if (step === 'compose') {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Create HTML</h1>
          <HtmlCompositionForm
            html={html}
            onChange={setHtml}
            onSubmit={() => setStep('inscribe')}
          />
        </div>
      </div>
    );
  }

  return (
    <ResourceInscriptionWizardContainer
      initialContentType="text/html"
      initialContent={html}
    />
  );
};

export default CreateHtmlPage;
