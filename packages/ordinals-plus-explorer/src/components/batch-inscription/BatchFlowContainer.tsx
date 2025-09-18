import React, { useState } from 'react';
import BatchUploadStep from './BatchUploadStep';
import BatchRunStep from './BatchRunStep';
import BatchSummaryStep from './BatchSummaryStep';

const BatchFlowContainer: React.FC = () => {
  const [step, setStep] = useState<number>(0);
  const [pkg, setPkg] = useState<any | undefined>(undefined);
  const [resultItems, setResultItems] = useState<any[] | undefined>(undefined);
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
        <span className={step===0? 'font-semibold text-gray-800 dark:text-gray-200' : ''}>1. Upload</span>
        <span>→</span>
        <span className={step===1? 'font-semibold text-gray-800 dark:text-gray-200' : ''}>2. Run</span>
        <span>→</span>
        <span className={step===2? 'font-semibold text-gray-800 dark:text-gray-200' : ''}>3. Summary</span>
      </div>
      {step === 0 && <BatchUploadStep onNext={() => setStep(1)} onPackageLoaded={(p)=> setPkg(p)} />}
      {step === 1 && <BatchRunStep onNext={() => setStep(2)} onBack={() => setStep(0)} pkg={pkg} onResults={(items)=> setResultItems(items)} />}
      {step === 2 && <BatchSummaryStep items={resultItems} pkg={pkg} />}
    </div>
  );
};

export default BatchFlowContainer;


