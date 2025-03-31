import React, { useState, useEffect } from 'react';
import { DidService, ResourceInfo, ResourceContent } from '../services/did-service';
import { CoreLinkedResource } from '../types';
import { formatResourceId, formatDate, getContentTypeShortName } from '../utils/formatting';
import { FileText, Image, Code, RefreshCw, Copy, Check } from 'lucide-react';
import ResourceCard from './ResourceCard';
import { useApiService } from '../hooks/useApiService';

interface LinkedResourceListProps {
  didString?: string;
  didService?: DidService;
  showAllResources?: boolean;
  contentTypeFilter?: string | null;
  onResourceSelect?: (resource: CoreLinkedResource) => void;
}

const LinkedResourceList: React.FC<LinkedResourceListProps> = ({ 
  didString,
  didService,
  showAllResources = false,
  contentTypeFilter = null,
  onResourceSelect
}) => {
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [linkedResources, setLinkedResources] = useState<CoreLinkedResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<ResourceContent | null>(null);
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [itemsPerPage] = useState<number>(20);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  const apiProvider = useApiService();
  const apiService = apiProvider.getApiService();
  
  useEffect(() => {
    if (showAllResources) {
      loadAllResources();
    } else if (didString) {
      loadResources();
    }
  }, [didString, showAllResources, currentPage]);
  
  const loadResources = async () => {
    if (!didString || !didService) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await apiService.fetchResourcesByDid(didString);
      
      if (response && response.linkedResources) {
        const mappedResources = response.linkedResources.map((resource: CoreLinkedResource) => ({
          resourceUri: resource.id,
          resourceCollectionId: didString,
          resourceId: resource.id,
          resourceName: resource.type || 'Resource',
          mediaType: resource.contentType,
          created: resource.info?.created || new Date().toISOString(),
          resourceType: resource.type,
          alsoKnownAs: []
        }));
        
        setResources(mappedResources);
        setLinkedResources(response.linkedResources as CoreLinkedResource[]);
      } else {
        setResources([]);
        setLinkedResources([]);
      }
      
      setLoading(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load resources';
      setError(errorMessage);
      setLoading(false);
    }
  };

  const loadAllResources = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching resources...');
      const response = await apiService.fetchAllResources(currentPage, itemsPerPage);
      
      if (response.error) {
        console.error('API returned error:', response.error);
        setError(response.error);
        setLinkedResources([]);
      } else if (!response.linkedResources || response.linkedResources.length === 0) {
        console.log('No resources found');
        if (currentPage === 0) {
          setError('No resources found. The API may be experiencing issues or there may be no resources available.');
        } else {
          setError(`No more resources available after page ${currentPage}.`);
          setCurrentPage(prev => Math.max(0, prev - 1));
        }
        setLinkedResources([]);
      } else {
        console.log(`Received ${response.linkedResources.length} resources`);
        // Ensure each resource has an inscriptionId
        const resourcesWithInscriptionIds = response.linkedResources.map(resource => {
          if (!resource.inscriptionId && resource.id) {
            // If inscriptionId is missing but we have an id, use it
            return {
              ...resource,
              inscriptionId: resource.id
            };
          }
          return resource;
        });
        setLinkedResources(resourcesWithInscriptionIds);
        setTotalItems(response.totalItems || response.linkedResources.length);
        setError(null);
      }
    } catch (err: unknown) {
      console.error('Error in loadAllResources:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load resources';
      setError(errorMessage);
      setLinkedResources([]);
    } finally {
      setLoading(false);
    }
  };
  
  const loadResourceContent = async (resourceId: string) => {
    if (selectedResource === resourceId && resourceContent) {
      // If already selected and loaded, just toggle off
      setSelectedResource(null);
      setResourceContent(null);
      return;
    }
    
    setSelectedResource(resourceId);
    setContentLoading(true);
    
    try {
      // Get the resource identifier - could be a DID, inscription ID, or resource ID
      const identifier = resourceId;
      
      // Use the universal resource content fetching method
      const res = await apiService.fetchResourceContent(identifier);
      
      if (res) {
        // For media content types that need a URL (images, videos, audio)
        if (
          res.contentType.startsWith('image/') || 
          res.contentType.startsWith('video/') || 
          res.contentType.startsWith('audio/')
        ) {
          // Use the content URL endpoint
          setResourceContent({
            content: apiService.getContentUrl(identifier),
            contentType: res.contentType
          });
        } else {
          // For other content types, use the content directly
          setResourceContent({
            content: res.content,
            contentType: res.contentType
          });
        }
      } else {
        // Fallback for resources not found or without content
        if (showAllResources) {
          // For LinkedResource type
          const resource = linkedResources.find(r => r.id === resourceId);
          if (resource) {
            setResourceContent({
              content: apiService.getContentUrl(resource.id),
              contentType: resource.contentType || 'application/octet-stream'
            });
          } else {
            throw new Error('Resource content not available');
          }
        } else {
          // For ResourceInfo type
          const resource = resources.find(r => r.resourceId === resourceId);
          console.log('resource', resource);
          if (resource) {
            setResourceContent({
              content: apiService.getContentUrl(resource.resourceId),
              contentType: resource.mediaType || 'application/octet-stream'
            });
          } else {
            throw new Error('Resource content not available');
          }
        }
      }
    } catch (err: unknown) {
      console.error('Error loading resource content:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load resource content';
      setError(errorMessage);
    } finally {
      setContentLoading(false);
    }
  };
  
  const getResourceIcon = (mediaType: string) => {
    if (!mediaType || mediaType === 'unknown') {
      return <FileText className="h-5 w-5 text-gray-500" />;
    }
    
    if (mediaType.startsWith('image/')) {
      return <Image className="h-5 w-5 text-pink-500" />;
    } else if (mediaType.startsWith('application/json')) {
      return <Code className="h-5 w-5 text-blue-500" />;
    } else {
      return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };
  
  // Pagination controls
  const handleNextPage = () => {
    setCurrentPage(prev => prev + 1);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(0, prev - 1));
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setCopiedText(text);
        setTimeout(() => setCopiedText(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };
  
  const handleResourceClick = (resource: CoreLinkedResource) => {
    setSelectedResource(resource.id);
    onResourceSelect?.(resource);
  };
  
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center items-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
          {error}
        </div>
      ) : linkedResources.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No resources found
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {linkedResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onClick={() => handleResourceClick(resource)}
              isSelected={selectedResource === resource.id}
            />
          ))}
        </div>
      )}
      
      {!loading && linkedResources.length > 0 && (
        <div className="flex justify-center space-x-4 mt-4">
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
            Page {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={handleNextPage}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default LinkedResourceList; 