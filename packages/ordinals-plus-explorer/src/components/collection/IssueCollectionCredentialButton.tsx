import React, { useState } from 'react';
import { collectionService } from '../../services/collectionService';
import useUserDids from '../../hooks/useUserDids';

interface IssueCollectionCredentialButtonProps {
  collectionId: string;
  curatorDid: string;
  onCredentialIssued?: (credentialId: string) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Button component for issuing a collection credential
 */
const IssueCollectionCredentialButton: React.FC<IssueCollectionCredentialButtonProps> = ({
  collectionId,
  curatorDid,
  onCredentialIssued,
  disabled = false,
  className = ''
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDid, setSelectedDid] = useState(curatorDid);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { userDids, isLoading: isLoadingDids } = useUserDids();
  
  const openModal = () => {
    setIsModalOpen(true);
    setError(null);
    setSuccess(null);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
  };
  
  const handleIssueCredential = async () => {
    if (!selectedDid) {
      setError('Please select a DID to issue the credential');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await collectionService.issueCollectionCredential(collectionId, selectedDid);
      
      if (result.status === 'success' && result.data?.credentialId) {
        setSuccess('Collection credential issued successfully!');
        
        // Call the callback if provided
        if (onCredentialIssued) {
          onCredentialIssued(result.data.credentialId);
        }
        
        // Close the modal after a delay
        setTimeout(() => {
          closeModal();
        }, 2000);
      } else {
        setError(result.message || 'Failed to issue collection credential');
      }
    } catch (err: any) {
      console.error('Error issuing collection credential:', err);
      setError(err.message || 'An error occurred while issuing the credential');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <>
      <button
        className={`px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 ${className}`}
        onClick={openModal}
        disabled={disabled || isLoading}
      >
        {isLoading ? 'Issuing...' : 'Issue Collection Credential'}
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-semibold mb-4 dark:text-white">
              Issue Collection Credential
            </h3>
            
            <p className="mb-4 text-gray-700 dark:text-gray-300">
              This will issue a verifiable credential for your collection, which can be used to verify its authenticity.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Select Issuer DID
              </label>
              <select
                className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                value={selectedDid}
                onChange={(e) => setSelectedDid(e.target.value)}
                disabled={isLoadingDids}
              >
                {isLoadingDids ? (
                  <option>Loading DIDs...</option>
                ) : (
                  userDids.map((did: string) => (
                    <option key={did} value={did}>
                      {did}
                    </option>
                  ))
                )}
              </select>
            </div>
            
            {error && (
              <div className="mb-4 p-2 bg-red-100 border border-red-400 text-red-700 rounded-md">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-4 p-2 bg-green-100 border border-green-400 text-green-700 rounded-md">
                {success}
              </div>
            )}
            
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 dark:border-gray-600 dark:hover:bg-gray-700 dark:text-white"
                onClick={closeModal}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50 disabled:opacity-50"
                onClick={handleIssueCredential}
                disabled={isLoading || !selectedDid}
              >
                {isLoading ? 'Issuing...' : 'Issue Credential'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default IssueCollectionCredentialButton;
