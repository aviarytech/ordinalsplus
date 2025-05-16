import React, { useState, useEffect } from 'react';
import { LinkedResource } from 'ordinalsplus';
import { useApi } from '../../context/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import DIDResourceUploadForm from './DIDResourceUploadForm';
import { Loader2, PlusCircle, MinusCircle, ExternalLink } from 'lucide-react';

interface DIDResourceManagerProps {
  didId: string;
  onResourceSelected?: (resource: LinkedResource) => void;
}

/**
 * Component for managing resources linked to a DID
 * Includes listing existing resources and adding new ones
 */
const DIDResourceManager: React.FC<DIDResourceManagerProps> = ({
  didId,
  onResourceSelected
}) => {
  // State
  const [resources, setResources] = useState<LinkedResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  
  // Context hooks
  const { apiService } = useApi();
  const { addToast, addErrorToast } = useToast();
  
  // Load resources when DID changes
  useEffect(() => {
    if (didId) {
      fetchResources();
    }
  }, [didId]);
  
  // Fetch resources for the DID
  const fetchResources = async () => {
    if (!didId) return;
    if (!apiService) {
      setError('API service is not available');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await apiService.getResourcesByDid(didId);
      setResources(result.linkedResources || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error fetching resources: ${errorMessage}`);
      addErrorToast(new Error(`Failed to Load Resources: ${errorMessage}`));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle successful resource upload
  const handleResourceUploaded = (_resourceId: string) => {
    // Refresh the resource list
    fetchResources();
    
    // Hide the upload form
    setShowUploadForm(false);
    
    // Show success message
    addToast(`Successfully added resource to DID: ${didId}`);
  };
  
  // Handle resource selection
  const handleResourceClick = (resource: LinkedResource) => {
    if (onResourceSelected) {
      onResourceSelected(resource);
    }
  };
  
  // Format timestamp for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  };
  
  // Get resource type display name
  const getResourceTypeDisplay = (type: string): string => {
    return type.charAt(0).toUpperCase() + type.slice(1);
  };
  
  // Get icon for resource type
  const getResourceIcon = (_resource: LinkedResource): React.ReactNode => {
    // This could be expanded with more specific icons based on content type
    return null;
  };
  
  // Render resource list
  const renderResourceList = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="ml-2 text-gray-700 dark:text-gray-300">Loading resources...</span>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mt-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      );
    }
    
    if (resources.length === 0) {
      return (
        <div className="text-center p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            No resources found for this DID
          </p>
          <button
            type="button"
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Add Resource
          </button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Resources ({resources.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <PlusCircle className="h-4 w-4 mr-1" />
            Add
          </button>
        </div>
        
        <div className="overflow-hidden bg-white dark:bg-gray-800 shadow sm:rounded-md">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {resources.map((resource) => (
              <li key={resource.id}>
                <div 
                  className="block hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                  onClick={() => handleResourceClick(resource)}
                >
                  <div className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        {getResourceIcon(resource)}
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 truncate">
                          {resource.metadata?.name || resource.id.split('/').pop() || 'Unnamed Resource'}
                        </p>
                      </div>
                      <div className="ml-2 flex-shrink-0 flex">
                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                          {getResourceTypeDisplay(resource.type)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 sm:flex sm:justify-between">
                      <div className="sm:flex">
                        <p className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                          {resource.contentType}
                        </p>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400 sm:mt-0">
                        <p>
                          Added {formatDate(resource.createdAt)}
                        </p>
                        {resource.content_url && (
                          <a 
                            href={resource.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };
  
  return (
    <div className="space-y-6">
      {showUploadForm ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Add New Resource
            </h3>
            <button
              type="button"
              onClick={() => setShowUploadForm(false)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <MinusCircle className="h-4 w-4 mr-1" />
              Cancel
            </button>
          </div>
          
          <DIDResourceUploadForm 
            didId={didId}
            onSuccess={handleResourceUploaded}
            onError={(error) => {
              addErrorToast(error);
            }}
          />
        </div>
      ) : (
        renderResourceList()
      )}
    </div>
  );
};

export default DIDResourceManager;
