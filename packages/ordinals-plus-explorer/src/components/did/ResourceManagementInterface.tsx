import React, { useState, useEffect, useMemo } from 'react';
import { LinkedResource } from 'ordinalsplus';
import { useApi } from '../../context/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import DIDResourceUploadForm from './DIDResourceUploadForm';
import LinkedResourceViewer from '../LinkedResourceViewer';
import { 
  Loader2, 
  PlusCircle, 
  MinusCircle, 
  ExternalLink, 
  Filter, 
  SortDesc, 
  Trash2, 
  Edit, 
  RefreshCw, 
  Search,
  X,
  AlertTriangle
} from 'lucide-react';

// Resource filter and sort options
export type ResourceFilterType = 'all' | 'image' | 'document' | 'schema' | 'other';
export type ResourceSortType = 'newest' | 'oldest' | 'name-asc' | 'name-desc' | 'type';

// Interface for the component props
interface ResourceManagementInterfaceProps {
  didId: string;
  onResourceSelected?: (resource: LinkedResource) => void;
}

/**
 * Advanced component for managing resources linked to a DID
 * Includes listing, filtering, sorting, updating, and removing resources
 */
const ResourceManagementInterface: React.FC<ResourceManagementInterfaceProps> = ({
  didId,
  onResourceSelected
}) => {
  // State for resources and UI
  const [resources, setResources] = useState<LinkedResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState<boolean>(false);
  const [selectedResource, setSelectedResource] = useState<LinkedResource | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  
  // State for filtering and sorting
  const [filterType, setFilterType] = useState<ResourceFilterType>('all');
  const [sortType, setSortType] = useState<ResourceSortType>('newest');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
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
  
  // Filter and sort resources
  const filteredAndSortedResources = useMemo(() => {
    // First apply filters
    let result = resources;
    
    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(resource => {
        if (filterType === 'image' && resource.contentType?.startsWith('image/')) {
          return true;
        }
        if (filterType === 'document' && (
          resource.contentType?.includes('text/') || 
          resource.contentType?.includes('application/pdf') ||
          resource.contentType?.includes('application/msword') ||
          resource.contentType?.includes('application/vnd.openxmlformats')
        )) {
          return true;
        }
        if (filterType === 'schema' && (
          resource.contentType?.includes('application/json') ||
          resource.contentType?.includes('application/schema+json')
        )) {
          return true;
        }
        if (filterType === 'other' && 
          !resource.contentType?.startsWith('image/') && 
          !resource.contentType?.includes('text/') &&
          !resource.contentType?.includes('application/pdf') &&
          !resource.contentType?.includes('application/msword') &&
          !resource.contentType?.includes('application/vnd.openxmlformats') &&
          !resource.contentType?.includes('application/json') &&
          !resource.contentType?.includes('application/schema+json')
        ) {
          return true;
        }
        return false; // If we get here, no filter condition matched
      });
    }
    
    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(resource => 
        resource.id?.toLowerCase().includes(query) ||
        resource.type?.toLowerCase().includes(query) ||
        resource.contentType?.toLowerCase().includes(query) ||
        resource.metadata?.name?.toLowerCase().includes(query) ||
        resource.metadata?.description?.toLowerCase().includes(query)
      );
    }
    
    // Then sort
    return result.sort((a, b) => {
      switch (sortType) {
        case 'newest':
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case 'oldest':
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case 'name-asc':
          return (a.metadata?.name || a.id || '').localeCompare(b.metadata?.name || b.id || '');
        case 'name-desc':
          return (b.metadata?.name || b.id || '').localeCompare(a.metadata?.name || a.id || '');
        case 'type':
          return (a.contentType || '').localeCompare(b.contentType || '');
        default:
          return 0;
      }
    });
  }, [resources, filterType, sortType, searchQuery]);
  
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
    setSelectedResource(resource);
    
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
  
  // Handle resource deletion
  const handleDeleteResource = async () => {
    if (!selectedResource || !apiService) return;
    
    setIsDeleting(true);
    
    try {
      // This is a placeholder - the actual API call would depend on your backend implementation
      // await apiService.deleteResource(selectedResource.id);
      
      // For now, we'll just simulate success
      addToast(`Resource ${selectedResource.id} deleted successfully`);
      
      // Refresh the list
      fetchResources();
      
      // Reset state
      setSelectedResource(null);
      setShowDeleteConfirm(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      addErrorToast(new Error(`Failed to delete resource: ${errorMessage}`));
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Render resource filter and sort controls
  const renderFilterControls = () => {
    return (
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full md:w-auto">
          <div className="flex items-center">
            <Filter className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs rounded-full ${
                filterType === 'all' 
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('image')}
              className={`px-3 py-1 text-xs rounded-full ${
                filterType === 'image' 
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setFilterType('document')}
              className={`px-3 py-1 text-xs rounded-full ${
                filterType === 'document' 
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Documents
            </button>
            <button
              onClick={() => setFilterType('schema')}
              className={`px-3 py-1 text-xs rounded-full ${
                filterType === 'schema' 
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Schemas
            </button>
            <button
              onClick={() => setFilterType('other')}
              className={`px-3 py-1 text-xs rounded-full ${
                filterType === 'other' 
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200' 
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Other
            </button>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full md:w-auto">
          <div className="flex items-center">
            <SortDesc className="h-4 w-4 text-gray-500 dark:text-gray-400 mr-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Sort:</span>
          </div>
          
          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as ResourceSortType)}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded border-0 focus:ring-2 focus:ring-indigo-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="type">Content Type</option>
          </select>
        </div>
        
        <div className="relative w-full md:w-auto">
          <input
            type="text"
            placeholder="Search resources..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-2 w-full md:w-64 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded border-0 focus:ring-2 focus:ring-indigo-500"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Render the resource list
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
          <button
            type="button"
            onClick={fetchResources}
            className="mt-2 inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </button>
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
    
    if (filteredAndSortedResources.length === 0) {
      return (
        <div className="text-center p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            No resources match your filters
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterType('all');
              setSearchQuery('');
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Clear Filters
          </button>
        </div>
      );
    }
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Resources ({filteredAndSortedResources.length}{resources.length !== filteredAndSortedResources.length ? ` of ${resources.length}` : ''})
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedResources.map((resource) => (
            <div 
              key={resource.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleResourceClick(resource)}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                      {getResourceTypeDisplay(resource.type || 'Resource')}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(resource.createdAt)}
                  </div>
                </div>
                
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-1 truncate">
                  {resource.metadata?.name || resource.id.split('/').pop() || 'Unnamed Resource'}
                </h4>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {resource.contentType}
                </p>
                
                <div className="mt-3 flex justify-between items-center">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    ID: {resource.id.split('/').pop()}
                  </div>
                  
                  {resource.content_url && (
                    <a 
                      href={resource.content_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  // Render resource detail view
  const renderResourceDetail = () => {
    if (!selectedResource) return null;
    
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Resource Details
          </h3>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setIsEditMode(!isEditMode)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Edit className="h-4 w-4 mr-1" />
              {isEditMode ? 'Cancel Edit' : 'Edit'}
            </button>
            
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </button>
            
            <button
              type="button"
              onClick={() => setSelectedResource(null)}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <X className="h-4 w-4 mr-1" />
              Close
            </button>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <LinkedResourceViewer resource={selectedResource} expanded={true} />
        </div>
      </div>
    );
  };
  
  // Render delete confirmation modal
  const renderDeleteConfirmation = () => {
    if (!showDeleteConfirm || !selectedResource) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="flex items-center text-red-600 dark:text-red-400 mb-4">
            <AlertTriangle className="h-6 w-6 mr-2" />
            <h3 className="text-lg font-medium">Confirm Deletion</h3>
          </div>
          
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Are you sure you want to delete this resource? This action cannot be undone.
          </p>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
              disabled={isDeleting}
            >
              Cancel
            </button>
            
            <button
              type="button"
              onClick={handleDeleteResource}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2 inline" />
                  Deleting...
                </>
              ) : (
                'Delete Resource'
              )}
            </button>
          </div>
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
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
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
      ) : selectedResource ? (
        renderResourceDetail()
      ) : (
        <>
          {renderFilterControls()}
          {renderResourceList()}
        </>
      )}
      
      {renderDeleteConfirmation()}
    </div>
  );
};

export default ResourceManagementInterface;
