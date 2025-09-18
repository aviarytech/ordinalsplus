import React from 'react';
import WalletConnector from '../components/WalletConnector';
import { useWallet } from '../context/WalletContext';
import BatchFlowContainer from '../components/batch-inscription/BatchFlowContainer';

const BatchInscriptionPage: React.FC = () => {
  const { connected } = useWallet();
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Batch Inscription</h1>
        {!connected ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">Connect your wallet to start a batch.</p>
            <WalletConnector />
          </div>
        ) : (
          <BatchFlowContainer />
        )}
      </div>
    </div>
  );
};

export default BatchInscriptionPage;


