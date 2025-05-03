import React, { useState, useEffect } from 'react';
import { X, CheckCircle, ArrowRightCircle, Loader2 } from 'lucide-react';
import { useApi } from '../../context/ApiContext';
import { useWallet } from '../../context/WalletContext';
import { useToast } from '../../contexts/ToastContext';

export interface PendingTransaction {
  id: string;
  txid?: string;
  type: 'COMMIT' | 'REVEAL';
  createdAt: Date;
  status: string;
  network: string;
}

interface TransactionRecoveryModalProps {
  onClose: () => void;
  onResumeTransaction: (transactionId: string) => Promise<boolean>;
}

/**
 * Modal component that allows users to recover interrupted transactions
 */
const TransactionRecoveryModal: React.FC<TransactionRecoveryModalProps> = ({
  onClose,
  onResumeTransaction
}) => {
  const { apiService } = useApi();
  const { network } = useWallet();
  const { addToast } = useToast();
  
  const [pendingTransactions, setPendingTransactions] = useState<PendingTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumingTxId, setResumingTxId] = useState<string | null>(null);
  
  // Load pending transactions on mount
  useEffect(() => {
    const loadPendingTransactions = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // This would be implemented in a real API service
        if (!apiService) {
          throw new Error('API service not available');
        }
        
        // Mock implementation - would call API in real version
        // const transactions = await apiService.getPendingTransactions(network);
        
        // Mocked data for demonstration
        const mockTransactions: PendingTransaction[] = [
          {
            id: 'commit-' + Date.now(),
            txid: '4a5e1e4baab89f3a32518a88c31bc87f618f76673e2cc77ab2127b7afdeda33b',
            type: 'COMMIT',
            createdAt: new Date(Date.now() - 3600000), // 1 hour ago
            status: 'BROADCASTING',
            network: network || 'bitcoin'
          },
          {
            id: 'reveal-' + Date.now(),
            type: 'REVEAL',
            createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
            status: 'PENDING',
            network: network || 'bitcoin'
          }
        ];
        
        setPendingTransactions(mockTransactions);
      } catch (err) {
        setError(`Failed to load pending transactions: ${(err as Error).message}`);
        console.error('Error loading pending transactions:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPendingTransactions();
  }, [apiService, network]);
  
  // Handle resuming a transaction
  const handleResume = async (transactionId: string) => {
    setResumingTxId(transactionId);
    
    try {
      const success = await onResumeTransaction(transactionId);
      
      if (success) {
        addToast(`Transaction ${transactionId} resumed successfully`, 'success');
        // Remove from pending list
        setPendingTransactions(prev => 
          prev.filter(tx => tx.id !== transactionId)
        );
      } else {
        addToast(`Failed to resume transaction ${transactionId}`, 'error');
      }
    } catch (err) {
      addToast(`Error resuming transaction: ${(err as Error).message}`, 'error');
      console.error('Error resuming transaction:', err);
    } finally {
      setResumingTxId(null);
    }
  };
  
  // Format date for display
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleString();
  };
  
  // No pending transactions to show
  if (!isLoading && pendingTransactions.length === 0 && !error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
          <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Transaction Recovery</h3>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-6 text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-300">No interrupted transactions found.</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">All your transactions appear to be completed or in progress.</p>
            
            <button
              type="button"
              className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Transaction Recovery</h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-500 focus:outline-none"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-gray-600 dark:text-gray-300">Loading interrupted transactions...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              <p>{error}</p>
              <button
                type="button"
                className="mt-4 px-4 py-2 bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-300 rounded-md hover:bg-red-200 dark:hover:bg-red-700"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                We found the following interrupted transactions. Would you like to resume them?
              </p>
              
              <div className="space-y-4">
                {pendingTransactions.map(tx => (
                  <div key={tx.id} className="border dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-750">
                    <div className="flex justify-between">
                      <div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">
                          {tx.type}
                        </span>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Started: {formatDate(tx.createdAt)}
                        </p>
                        {tx.txid && (
                          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1 truncate">
                            TXID: {tx.txid.substring(0, 10)}...{tx.txid.substring(tx.txid.length - 10)}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Status: {tx.status}
                        </p>
                      </div>
                      
                      <button
                        type="button"
                        className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                        onClick={() => handleResume(tx.id)}
                        disabled={resumingTxId === tx.id}
                      >
                        {resumingTxId === tx.id ? (
                          <>
                            <Loader2 className="-ml-0.5 mr-1.5 h-4 w-4 animate-spin" />
                            Resuming...
                          </>
                        ) : (
                          <>
                            <ArrowRightCircle className="-ml-0.5 mr-1.5 h-4 w-4" />
                            Resume
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={onClose}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionRecoveryModal; 