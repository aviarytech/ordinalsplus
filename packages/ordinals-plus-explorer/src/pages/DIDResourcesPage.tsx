import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApi } from '../context/ApiContext';
import { useToast } from '../contexts/ToastContext';
import { useWallet } from '../context/WalletContext';
import ResourceManagementInterface from '../components/did/ResourceManagementInterface';
import LinkedResourceViewer from '../components/LinkedResourceViewer';
import DidDocumentViewer from '../components/DidDocumentViewer';
import { LinkedResource } from 'ordinalsplus';
import { Loader2, ArrowLeft, ExternalLink, Key } from 'lucide-react';

/**
 * Page for viewing and managing resources linked to a specific DID
 */
const DIDResourcesPage: React.FC = () => {
  // Get DID ID from URL params
  const { didId } = useParams<{ didId: string }>();
  const navigate = useNavigate();
  
  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [didDocument, setDidDocument] = useState<any | null>(null);
  const [selectedResource, setSelectedResource] = useState<LinkedResource | null>(null);
  
  // Context hooks
  const { apiService } = useApi();
  const { addErrorToast } = useToast();
  const { connected: walletConnected, address: walletAddress } = useWallet();
  
  // Load DID document when DID ID changes
  useEffect(() => {
    if (didId) {
      fetchDidDocument();
    }
  }, [didId]);
  
  // Fetch DID document
  const fetchDidDocument = async () => {
    if (!didId) return;
    if (!apiService) {
      setError('API service is not available');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiService.resolveDid(didId);
      setDidDocument(result.didDocument || null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error resolving DID: ${errorMessage}`);
      addErrorToast(new Error(`Failed to Resolve DID: ${errorMessage}`));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle resource selection
  const handleResourceSelected = (resource: LinkedResource) => {
    setSelectedResource(resource);
  };
  
  // Check if the current wallet owns this DID
  const isOwnedByCurrentWallet = (): boolean => {
    if (!walletConnected || !walletAddress || !didDocument) return false;
    
    // Check if the wallet address is listed as a controller in the DID document
    if (didDocument.controller) {
      if (Array.isArray(didDocument.controller)) {
        return didDocument.controller.includes(walletAddress);
      } else {
        return didDocument.controller === walletAddress;
      }
    }
    
    // Check verification methods
    if (didDocument.verificationMethod) {
      return didDocument.verificationMethod.some((method: any) => 
        method.controller === walletAddress || 
        method.publicKeyAddress === walletAddress
      );
    }
    
    return false;
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="ml-2 text-gray-700 dark:text-gray-300">Loading DID resources...</span>
      </div>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-5">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mt-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }
  
  // Render main content
  return (
    <div className="max-w-7xl mx-auto p-5">
      <header className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
          <div>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 mb-2 sm:mb-0"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>
          </div>
          
          <div className="flex items-center">
            {isOwnedByCurrentWallet() && (
              <div className="mr-4 px-3 py-1 bg-green-100 dark:bg-green-800/30 text-green-800 dark:text-green-300 text-sm rounded-full flex items-center">
                <Key className="h-3 w-3 mr-1" />
                You control this DID
              </div>
            )}
            
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">
              {didId}
            </h1>
            
            <a
              href={`https://btco.id/${didId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>
      
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar - DID Document */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
              DID Document
            </h2>
            
            {didDocument ? (
              <DidDocumentViewer document={didDocument} />
            ) : (
              <p className="text-gray-600 dark:text-gray-400">
                No DID document available
              </p>
            )}
          </div>
        </div>
        
        {/* Main content - Resource Manager */}
        <div className="lg:col-span-2">
          {selectedResource ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Resource Details
                </h2>
                <button
                  type="button"
                  onClick={() => setSelectedResource(null)}
                  className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to Resources
                </button>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                <LinkedResourceViewer resource={selectedResource} />
              </div>
            </div>
          ) : (
            <ResourceManagementInterface 
              didId={didId || ''}
              onResourceSelected={handleResourceSelected}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default DIDResourcesPage;
