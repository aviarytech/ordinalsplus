import React, { useState, useEffect } from 'react';
import { useResourceInscription } from './ResourceInscriptionWizard';
import { useWallet } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import { Button } from '../ui';
import { CheckCircle, Copy, ExternalLink, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import DidPreview from './DidPreview';

/**
 * CompletionStep displays the completed resource inscription details and provides
 * options to view the inscription or start a new one.
 */
const CompletionStep: React.FC = () => {
  const { state, resetState } = useResourceInscription();
  const { network: walletNetwork } = useWallet();
  const { apiService } = useApi();
  const { addToast } = useToast();
  
  const [inscriptionId, setInscriptionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resourceDetails, setResourceDetails] = useState<any | null>(null);
  
  // Get block explorer URL based on network
  const blockExplorerUrl = walletNetwork === 'testnet'
    ? 'https://mempool.space/testnet'
    : 'https://mempool.space';
  
  // Copy to clipboard
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        addToast(`${label} copied to clipboard`, 'success');
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };
  
  // Fetch inscription details
  const fetchInscriptionDetails = async () => {
    if (!state.transactionInfo.revealTx) return;
    
    setIsLoading(true);
    
    try {
      const networkType = walletNetwork || 'mainnet';
      
      // For now, just set the inscription ID from the reveal transaction
      // In the future, we can implement proper API calls to fetch inscription details
      setInscriptionId(state.transactionInfo.revealTx);
      
      console.log('Inscription completed for network:', networkType);
    } catch (error) {
      console.error('Error fetching inscription details:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch inscription details on component mount
  useEffect(() => {
    if (state.transactionInfo.status === 'completed' && state.transactionInfo.revealTx) {
      fetchInscriptionDetails();
    }
  }, [state.transactionInfo.status, state.transactionInfo.revealTx]);
  
  // Start a new inscription
  const handleStartNew = () => {
    resetState();
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center mb-8">
        <div className="bg-green-100 dark:bg-green-900/30 p-4 rounded-full">
          <CheckCircle className="h-12 w-12 text-green-500" />
        </div>
      </div>
      
      <h1 className="text-2xl font-bold text-green-800 dark:text-green-200 mb-4">
        🎉 Resource Inscription Complete!
      </h1>
      
      {/* DID Preview - Always visible at top */}
      <DidPreview />
      
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Your resource has been successfully inscribed on the Bitcoin blockchain.
        You can view the details below or explore it in a block explorer.
      </p>
      
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="space-y-6 mt-8">
          {/* Inscription ID */}
          {inscriptionId && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Inscription ID
              </h3>
              <div className="flex items-center space-x-2">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded flex-1 overflow-x-auto">
                  {inscriptionId}
                </code>
                <button
                  onClick={() => copyToClipboard(inscriptionId, 'Inscription ID')}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={`${blockExplorerUrl}/inscription/${inscriptionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                  title="View on block explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
          
          {/* Transaction IDs */}
          {state.transactionInfo.commitTx && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Commit Transaction
              </h3>
              <div className="flex items-center space-x-2">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded flex-1 overflow-x-auto">
                  {state.transactionInfo.commitTx}
                </code>
                <button
                  onClick={() => copyToClipboard(state.transactionInfo.commitTx!, 'Commit TXID')}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={`${blockExplorerUrl}/tx/${state.transactionInfo.commitTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                  title="View on block explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
          
          {state.transactionInfo.revealTx && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Reveal Transaction
              </h3>
              <div className="flex items-center space-x-2">
                <code className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded flex-1 overflow-x-auto">
                  {state.transactionInfo.revealTx}
                </code>
                <button
                  onClick={() => copyToClipboard(state.transactionInfo.revealTx!, 'Reveal TXID')}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  title="Copy to clipboard"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={`${blockExplorerUrl}/tx/${state.transactionInfo.revealTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300"
                  title="View on block explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          )}
          
          {/* Resource Details */}
          {resourceDetails && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                Resource Details
              </h3>
              
              <div className="space-y-3">
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Title</h4>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{resourceDetails.name}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Description</h4>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{resourceDetails.description}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Type</h4>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{resourceDetails.type}</p>
                </div>
                
                <div>
                  <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Content Type</h4>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{resourceDetails.contentType}</p>
                </div>
                
                {resourceDetails.isVerifiableCredential && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400">Verifiable Credential</h4>
                    <p className="text-sm text-gray-800 dark:text-gray-200">Yes</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Content Preview */}
          {state.contentData.preview && state.contentData.type?.startsWith('image/') && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Preview
              </h3>
              <div className="mt-2 flex justify-center">
                <img 
                  src={state.contentData.preview} 
                  alt="Resource content" 
                  className="max-h-64 rounded border border-gray-300 dark:border-gray-600" 
                />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
        {inscriptionId && (
          <a
            href={`/resource/${inscriptionId}`}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            View Resource <ArrowRight className="ml-2 h-4 w-4" />
          </a>
        )}
        
        <Button
          onClick={handleStartNew}
          variant="outline"
          className="px-4 py-2"
        >
          Create Another Resource
        </Button>
      </div>
    </div>
  );
};

export default CompletionStep;
