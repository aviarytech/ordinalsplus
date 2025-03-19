import React, { useState, useEffect } from 'react';
import { DidService, ResourceInfo, ResourceContent } from '../services/did-service';
import { LinkedResource } from '../types';
import { formatResourceId, formatDate, getContentTypeShortName } from '../utils/formatting';
import { ExternalLink, FileText, Image, Code, RefreshCw, Filter, Copy, Check } from 'lucide-react';
import ResourceCard from './ResourceCard';
import ApiServiceProvider from '../services/ApiServiceProvider';

interface LinkedResourceListProps {
  didString?: string;
  didService?: DidService;
  showAllResources?: boolean;
  contentTypeFilter?: string | null;
}

const LinkedResourceList: React.FC<LinkedResourceListProps> = ({ 
  didString,
  didService,
  showAllResources = false,
  contentTypeFilter = null
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
      // In a real implementation, we would fetch the linked resources for this DID
      // For now, we'll simulate with a delay
      setTimeout(() => {
        // This would be replaced with actual API calls using the didService
        // For example:
        // const collection = await didService.getCollection(`${didString}/0`);
        // setResources(collection.resources);
        
        // Mock data for demonstration
        const mockResources: ResourceInfo[] = [
          {
            resourceUri: `${didString}/0`,
            resourceCollectionId: didString,
            resourceId: `${didString}/0`,
            resourceName: 'Profile',
            mediaType: 'application/json',
            created: new Date().toISOString(),
            resourceType: 'Profile',
            alsoKnownAs: []
          },
          {
            resourceUri: `${didString}/1`,
            resourceCollectionId: didString,
            resourceId: `${didString}/1`,
            resourceName: 'Avatar',
            mediaType: 'image/png',
            created: new Date().toISOString(),
            resourceType: 'Image',
            alsoKnownAs: []
          },
          {
            resourceUri: `${didString}/2`,
            resourceCollectionId: didString,
            resourceId: `${didString}/2`,
            resourceName: 'Schema',
            mediaType: 'application/json',
            created: new Date().toISOString(),
            resourceType: 'Schema',
            alsoKnownAs: []
          }
        ];
        
        setResources(mockResources);
        setLoading(false);
      }, 1000);
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
      // Get the API service provider instance
      const apiService = ApiServiceProvider.getInstance();
      
      // Fetch all inscriptions/resources
      const response = await apiService.fetchAllInscriptions(currentPage, itemsPerPage);
      
      if (response.error) {
        setError(response.error);
      } else {
        setLinkedResources(response.linkedResources);
        setTotalItems(response.totalItems);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load all resources';
      setError(errorMessage);
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
      if (showAllResources) {
        // For resources from the ORD Node API
        const resource = linkedResources.find(r => r.resourceId === resourceId);
        if (!resource) {
          throw new Error('Resource not found');
        }
        
        // Get the API service provider instance
        const apiService = ApiServiceProvider.getInstance();
        
        // For image content, use the content URL instead of the raw content
        if (resource.contentType.startsWith('image/')) {
          setResourceContent({
            content: apiService.getContentUrl(resource.inscriptionId),
            contentType: resource.contentType
          });
        } else {
          // Use the content directly from the LinkedResource
          setResourceContent({
            content: resource.content,
            contentType: resource.contentType
          });
        }
        setContentLoading(false);
      } else {
        // For resources from the DID service
        // In a real implementation, we would fetch the resource content
        // For example:
        // const content = await didService.getResourceContent(resourceId);
        
        // Mock data for demonstration
        setTimeout(() => {
          let mockContent: ResourceContent;
          
          const resourceInfo = resources.find(r => r.resourceId === resourceId);
          if (!resourceInfo) {
            throw new Error('Resource not found');
          }
          
          if (resourceInfo.mediaType === 'application/json') {
            mockContent = {
              content: { name: 'Example Resource', description: 'This is mock content for the resource' },
              contentType: 'application/json'
            };
          } else if (resourceInfo.mediaType.startsWith('image/')) {
            mockContent = {
              content: 'https://via.placeholder.com/300',
              contentType: resourceInfo.mediaType
            };
          } else {
            mockContent = {
              content: 'Plain text content for the resource',
              contentType: 'text/plain'
            };
          }
          
          setResourceContent(mockContent);
          setContentLoading(false);
        }, 800);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load resource content';
      setError(errorMessage);
      setContentLoading(false);
    }
  };
  
  const getResourceIcon = (mediaType: string) => {
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
  
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          {showAllResources ? 
            contentTypeFilter ? 
              `${contentTypeFilter.startsWith('image/') ? 'Image' : contentTypeFilter} Resources` 
              : 'All Resources' 
            : `Linked Resources for ${didString}`}
        </h2>
        <button 
          onClick={showAllResources ? loadAllResources : loadResources}
          className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 dark:text-indigo-100 dark:bg-indigo-900 dark:hover:bg-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-300">Loading resources...</span>
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            </div>
          </div>
        </div>
      ) : showAllResources ? (
        <div>
          {/* Filter resources based on contentTypeFilter */}
          {(() => {
            // Apply content type filtering
            const filteredResources = contentTypeFilter 
              ? linkedResources.filter(resource => 
                  resource.contentType && resource.contentType.startsWith(contentTypeFilter))
              : linkedResources;
              
            if (filteredResources.length === 0) {
              return (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {contentTypeFilter 
                    ? `No ${contentTypeFilter.startsWith('image/') ? 'image' : contentTypeFilter} resources found.` 
                    : 'No resources found.'}
                </p>
              );
            }
            
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredResources.map((resource) => (
                  <div 
                    key={resource.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center">
                          {getResourceIcon(resource.contentType)}
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white ml-2">
                            {resource.resourceType || 'Resource'}
                          </h3>
                        </div>
                        <div>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {getContentTypeShortName(resource.contentType)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="mt-2">
                        {/* Show only resource ID in card view */}
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                          <span className="font-medium">Resource ID:</span> 
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-mono break-all">
                          {formatResourceId(resource.resourceId)}
                        </p>
                      </div>
                      
                      {/* Preview for image resources */}
                      {resource.contentType.startsWith('image/') && (
                        <div className="mt-3 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-900 h-40 flex items-center justify-center">
                          <img 
                            src={typeof resource.content === 'string' ? resource.content : ''}
                            alt={`Resource ${formatResourceId(resource.id)}`}
                            className="max-h-full max-w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Image+Error';
                              e.currentTarget.alt = 'Error loading image';
                            }}
                          />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900">
                      <button
                        onClick={() => loadResourceContent(resource.resourceId)}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 flex items-center"
                      >
                        {selectedResource === resource.resourceId ? 'Hide Details' : 'View Details'}
                        <ExternalLink className="h-3.5 w-3.5 ml-1" />
                      </button>
                      
                      <a 
                        href={`/resource/${resource.resourceId}`}
                        className="text-sm font-medium text-gray-600 hover:text-gray-500 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        View Full Page
                      </a>
                    </div>
                    
                    {selectedResource === resource.resourceId && (
                      <div className="border-t border-gray-200 dark:border-gray-700">
                        {contentLoading ? (
                          <div className="p-4 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
                            <span className="ml-2 text-gray-600 dark:text-gray-400 text-sm">Loading content...</span>
                          </div>
                        ) : resourceContent ? (
                          <>
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                              {/* Complete resource details section */}
                              <div className="mb-4">
                                <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Resource Details</h4>
                                
                                <div className="grid gap-3">
                                  <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                      <span className="font-medium">Resource ID:</span> 
                                      <button 
                                        onClick={() => copyToClipboard(resource.resourceId)}
                                        className="ml-2 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center"
                                        title="Copy to clipboard"
                                      >
                                        {copiedText === resource.resourceId ? (
                                          <Check className="h-3.5 w-3.5" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-mono break-all">
                                      {formatResourceId(resource.resourceId)}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                      <span className="font-medium">Inscription ID:</span> 
                                      <button 
                                        onClick={() => copyToClipboard(resource.id)}
                                        className="ml-2 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center"
                                        title="Copy to clipboard"
                                      >
                                        {copiedText === resource.id ? (
                                          <Check className="h-3.5 w-3.5" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-mono break-all">
                                      {formatResourceId(resource.id)}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      <span className="font-medium">Content Type:</span> {resource.contentType}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      <span className="font-medium">Created:</span> {formatDate(resource.createdAt)}
                                    </p>
                                  </div>
                                  
                                  {resource.didReference && (
                                    <div>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                                        <span className="font-medium">DID:</span>
                                        <button 
                                          onClick={() => copyToClipboard(resource.didReference || '')}
                                          className="ml-2 text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 dark:hover:text-indigo-300 inline-flex items-center"
                                          title="Copy to clipboard"
                                        >
                                          {copiedText === resource.didReference ? (
                                            <Check className="h-3.5 w-3.5" />
                                          ) : (
                                            <Copy className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                      </p>
                                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono break-all">
                                        {formatResourceId(resource.didReference)}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            <div className="p-4">
                              <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">Resource Content</h4>
                              <ResourceCard 
                                content={resourceContent.content} 
                                contentType={resourceContent.contentType} 
                              />
                            </div>
                          </>
                        ) : (
                          <div className="p-4 text-gray-500 dark:text-gray-400 text-center text-sm italic">
                            Failed to load resource content
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
          
          {/* Pagination controls */}
          {linkedResources.length > 0 && (
            <div className="flex justify-between items-center mt-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {(() => {
                  // Calculate filtered count
                  const filteredCount = contentTypeFilter
                    ? linkedResources.filter(resource => 
                        resource.contentType && resource.contentType.startsWith(contentTypeFilter)).length
                    : linkedResources.length;
                    
                  return `Showing ${filteredCount} of ${totalItems}${contentTypeFilter ? ' filtered' : ''} resources`;
                })()}
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 0}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    currentPage === 0
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages - 1}
                  className={`px-3 py-1 rounded-md text-sm font-medium ${
                    currentPage >= totalPages - 1
                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          {resources.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">No resources found for this DID.</p>
          ) : (
            <div className="space-y-4">
              {resources.map((resource) => (
                <div
                  key={resource.resourceId}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedResource === resource.resourceId
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                  }`}
                  onClick={() => loadResourceContent(resource.resourceId)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center">
                      {getResourceIcon(resource.mediaType)}
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          {resource.resourceName || formatResourceId(resource.resourceId)}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {resource.resourceType || getContentTypeShortName(resource.mediaType)}
                        </p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(resource.created)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Resource content section */}
      {selectedResource && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Resource Content</h3>
          {contentLoading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-300">Loading content...</span>
            </div>
          ) : resourceContent ? (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-xs text-gray-800 dark:text-gray-200">
                {typeof resourceContent === 'string'
                  ? resourceContent
                  : JSON.stringify(resourceContent, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">No content available.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default LinkedResourceList; 