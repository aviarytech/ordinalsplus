import React, { useState, useEffect } from 'react';
import { DidService, ResourceInfo, ResourceContent } from '../services/did-service';
import { LinkedResource } from '../types';
import { formatResourceId, formatDate, getContentTypeShortName } from '../utils/formatting';
import { FileText, Image, Code, RefreshCw, Copy, Check } from 'lucide-react';
import ResourceCard from './ResourceCard';
import { useApiService } from '../hooks/useApiService';

interface LinkedResourceListProps {
  didString?: string;
  didService?: DidService;
  showAllResources?: boolean;
  contentTypeFilter?: string | null;
  onResourceSelect?: (resource: LinkedResource) => void;
}

const LinkedResourceList: React.FC<LinkedResourceListProps> = ({ 
  didString,
  didService,
  showAllResources = false,
  contentTypeFilter = null,
  onResourceSelect
}) => {
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [linkedResources, setLinkedResources] = useState<LinkedResource[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [resourceContent, setResourceContent] = useState<ResourceContent | null>(null);
  const [contentLoading, setContentLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [itemsPerPage] = useState<number>(20);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Use our custom hook to get the API service
  const apiService = useApiService();
  
  // Listen for the reset event to clear inscriptions when network changes
  useEffect(() => {
    const handleReset = () => {
      console.log('Resetting inscriptions due to network change');
      setLinkedResources([]);
      setTotalItems(0);
      setCurrentPage(0);
      setError(null);
      
      // Load new inscriptions after a small delay to ensure network change is complete
      setTimeout(() => {
        if (showAllResources) {
          loadAllResources();
        }
      }, 100);
    };
    
    // Listen for the custom reset event
    window.addEventListener('resetInscriptions', handleReset);
    
    return () => {
      window.removeEventListener('resetInscriptions', handleReset);
    };
  }, [showAllResources]); // Dependency array includes showAllResources
  
  useEffect(() => {
    if (showAllResources) {
      loadAllResources();
    } else if (didString) {
      loadResources();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [didString, showAllResources, currentPage]);
  
  const loadResources = async () => {
    if (!didString || !didService) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Use the actual API service to fetch resources for this DID
      const response = await apiService.fetchResourcesByDid(didString);
      
      if (response && response.linkedResources) {
        const mappedResources = response.linkedResources.map(resource => ({
          resourceUri: resource.id,
          resourceCollectionId: didString,
          resourceId: resource.id,
          resourceName: resource.type || 'Resource',
          mediaType: resource.contentType,
          created: resource.createdAt,
          resourceType: resource.resourceType,
          alsoKnownAs: []
        }));
        
        setResources(mappedResources);
        setLinkedResources(response.linkedResources);
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
      // Use the apiService from our hook
      console.log(`Fetching inscriptions for page ${currentPage}, limit ${itemsPerPage}`);
      const response = await apiService.fetchAllInscriptions(currentPage, itemsPerPage);
      
      if (response.error) {
        console.error('API returned error:', response.error);
        setError(response.error);
        setLinkedResources([]);
      } else if (response.linkedResources.length === 0) {
        // We got a successful response but no resources
        if (currentPage === 0) {
          // On first page, this means no resources found
          setError('No resources found. The API may be experiencing issues or there may be no inscriptions available.');
        } else {
          // On later pages, we've reached the end
          setError(`No more resources available after page ${currentPage}.`);
          // Go back to previous page that had data
          setCurrentPage(prev => Math.max(0, prev - 1));
        }
        setLinkedResources([]);
      } else {
        // Success with data
        console.log(`Received ${response.linkedResources.length} resources`);
        setLinkedResources(response.linkedResources);
        setTotalItems(response.totalItems || response.linkedResources.length);
        setError(null);
      }
    } catch (err: unknown) {
      console.error('Error in loadAllResources:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load resources';
      setError(`${errorMessage}. Please try again or switch networks.`);
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
  
  const handleResourceClick = (resource: LinkedResource) => {
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
    </div>
  );
};

export default LinkedResourceList; 