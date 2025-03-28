import React, { useEffect, useState } from 'react';
import { formatTimeAgo } from '../utils/date';
import { truncateMiddle } from '../utils/string';
import JSONFormatter from './JSONFormatter';
import { LinkedResource as ProjectLinkedResource } from '../types';
import { Copy, ExternalLink, Clock, Download } from 'lucide-react';
import { useApiService } from '../hooks/useApiService';
import ApiServiceProvider from '../services/ApiServiceProvider';

// Component-specific interface that matches what we're actually using
interface LinkedResourceViewProps {
  resource: ProjectLinkedResource; // Use the project's LinkedResource type
  jsonOnly?: boolean;
  expanded?: boolean;
}

const LinkedResourceViewer: React.FC<LinkedResourceViewProps> = ({
  resource,
  jsonOnly = false,
  expanded = false,
}) => {
  const [resourceContent, setResourceContent] = useState<unknown>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [fetchedText, setFetchedText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState<boolean>(false);
  const [textError, setTextError] = useState<boolean>(false);
  const apiService = useApiService();
  const apiServiceProvider = ApiServiceProvider.getInstance();

  const isJsonContent = 
    (resource.contentType && resource.contentType.includes('json')) || 
    (typeof resource.content === 'object' && resource.content !== null);

  useEffect(() => {
    if (typeof resource.content === 'string' && isJsonContent) {
      try {
        const parsedContent = JSON.parse(resource.content);
        setResourceContent(parsedContent);
      } catch {
        // If JSON parsing fails, use the original string content
        setResourceContent(resource.content);
      }
    } else {
      setResourceContent(resource.content);
    }
  }, [resource.content, isJsonContent]);
  
  // Add new effect to fetch text content directly
  useEffect(() => {
    const fetchTextContent = async () => {
      // Only try to fetch text content for text types, unknown types, or empty content types
      if (
        resource.inscriptionId && 
        (resource.contentType.includes('text/') || 
         resource.contentType === 'unknown' ||
         resource.contentType === '' ||
         (!resource.content && resource.inscriptionId))
      ) {
        setTextLoading(true);
        setTextError(false);
        
        try {
          const text = await apiServiceProvider.fetchTextContent(resource.inscriptionId);
          if (text) {
            setFetchedText(text);
          }
        } catch (error) {
          console.error('Error fetching text content:', error);
          setTextError(true);
        } finally {
          setTextLoading(false);
        }
      }
    };
    
    fetchTextContent();
  }, [resource.inscriptionId, resource.contentType]);

  const getInscriptionLink = () => {
    return `https://ordiscan.com/inscription/${resource.inscriptionId}`;
  };

  // Format a DID using sat number and inscription index
  const formatDid = (): string => {
    if (resource.sat) {
      // Extract inscription index from inscriptionId
      const match = resource.inscriptionId?.match(/i(\d+)$/);
      const index = match && match[1] ? match[1] : '0';
      return `did:btco:${resource.sat}/${index}`;
    }
    // For backwards compatibility only - log warning
    console.warn('Resource missing sat number, cannot create proper DID format');
    // This should eventually be removed once all resources have sat numbers
    return resource.didReference || `did:btco:${resource.inscriptionId}`;
  };

  const renderResourceContent = () => {
    if (jsonOnly) {
      return (
        <JSONFormatter 
          json={typeof resourceContent === 'object' ? resourceContent || {} : {}} 
          expanded={expanded} 
        />
      );
    }

    // Add check for fetched text content
    if (fetchedText && !textError && !textLoading) {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-[30rem]">
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
            {fetchedText}
          </pre>
        </div>
      );
    }
    
    // Add check for text loading state
    if (textLoading) {
      return (
        <div className="flex items-center justify-center h-40 bg-gray-50 dark:bg-gray-800">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 dark:border-blue-400 rounded-full border-t-transparent"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading text content...</span>
        </div>
      );
    }

    if (resource.contentType && resource.contentType.includes('image')) {
      // Get the proper image URL from the API service
      const imageUrl = apiService.getContentUrl(resource.inscriptionId);
      
      return (
        <div className={`relative flex flex-col items-center justify-center ${expanded ? 'py-4' : 'h-40'}`}>
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 animate-pulse">
              <span className="text-sm text-gray-500">Loading...</span>
            </div>
          )}
          {imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Image failed to load</span>
            </div>
          )}
          
          <img 
            src={imageUrl} 
            alt={`Resource ${resource.resourceId}`}
            className={`max-h-60 object-contain rounded-md ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity ${expanded ? 'max-w-md' : 'max-w-full'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              console.error(`Failed to load image for inscription ${resource.inscriptionId}`);
              setImageError(true);
            }}
          />
        </div>
      );
    }

    if (resource.contentType && resource.contentType.includes('text')) {
      // For text content
      if (fetchedText) {
        return (
          <div className="bg-white dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-[30rem]">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
              {fetchedText}
            </pre>
            {resource.inscriptionId && (
              <div className="mt-4 flex justify-end">
                <a
                  href={apiService.getContentUrl(resource.inscriptionId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 bg-orange-600 dark:bg-orange-700 text-white text-sm rounded hover:bg-orange-700 dark:hover:bg-orange-800"
                >
                  <Download className="inline h-3 w-3 mr-1" />
                  View Full Content
                </a>
              </div>
            )}
          </div>
        );
      }
      
      // If we're still loading text content, show a loading state
      if (textLoading) {
        return (
          <div className="flex items-center justify-center h-40 bg-gray-50 dark:bg-gray-800">
            <div className="animate-spin h-8 w-8 border-4 border-orange-500 dark:border-orange-400 rounded-full border-t-transparent"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading text content...</span>
          </div>
        );
      }

      // For plain text or HTML content from an inscription, use an iframe as fallback
      if (resource.inscriptionId) {
        const contentUrl = apiService.getContentUrl(resource.inscriptionId);
        
        return (
          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            <iframe 
              src={contentUrl}
              className="w-full h-[400px] border-0"
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            
            {imageError && (
              <div className="p-4 text-center text-sm text-red-500 dark:text-red-400">
                Failed to load text content
                <div className="mt-2">
                  <a
                    href={contentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-orange-600 dark:bg-orange-700 text-white text-sm rounded hover:bg-orange-700 dark:hover:bg-orange-800"
                  >
                    <ExternalLink className="inline h-3 w-3 mr-1" />
                    Open in New Tab
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      }
    }

    if (resource.contentType && resource.contentType.includes('audio')) {
      // Use DID reference if available, otherwise fall back to inscription ID
      const contentIdentifier = resource.didReference || resource.inscriptionId;
      const audioUrl = contentIdentifier 
        ? apiService.getContentUrl(contentIdentifier)
        : (typeof resource.content === 'string' ? resource.content : '');
        
      return (
        <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 rounded-xl">
          <audio 
            controls 
            className="w-full" 
            src={audioUrl}
            onError={() => {
              console.error('Failed to load audio', resource);
            }}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    if (resource.contentType && resource.contentType.includes('video')) {
      // Use DID reference if available, otherwise fall back to inscription ID
      const contentIdentifier = resource.didReference || resource.inscriptionId;
      const videoUrl = contentIdentifier 
        ? apiService.getContentUrl(contentIdentifier)
        : (typeof resource.content === 'string' ? resource.content : '');
        
      return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <video 
            controls 
            className="w-full" 
            src={videoUrl}
            onError={() => {
              console.error('Failed to load video', resource);
            }}
          >
            Your browser does not support the video element.
          </video>
        </div>
      );
    }

    // Show loading state
    if (textLoading) {
      return (
        <div className="flex items-center justify-center h-60 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 dark:border-blue-400 rounded-full border-t-transparent"></div>
        </div>
      );
    }
    
    // If we fetched text content directly, display it
    if (fetchedText) {
      return (
        <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 rounded-xl">
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
            {fetchedText}
          </pre>
          {resource.inscriptionId && (
            <div className="mt-4 flex justify-end">
              <a
                href={apiService.getContentUrl(resource.inscriptionId)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 rounded-md hover:bg-blue-700 dark:hover:bg-blue-800"
              >
                <Download className="mr-2 h-4 w-4" />
                Open in New Tab
              </a>
            </div>
          )}
        </div>
      );
    }
    
    // For text content when direct fetch failed
    if (textError && (resource.contentType.includes('text/') || resource.contentType === 'unknown' || resource.contentType === '')) {
      return renderTextFallback();
    }
    
    // No content available
    if (!resource.content) {
      // For text content when there's no direct content data but we have an inscriptionId,
      // we can still display it using an iframe pointing to the content URL
      if (resource.inscriptionId && 
          (resource.contentType.includes('text/') || 
           resource.contentType.includes('application/json') ||
           resource.contentType === 'unknown' || 
           resource.contentType === '')) {
        
        const contentUrl = apiService.getContentUrl(resource.inscriptionId);
        
        return (
          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-orange-100 dark:bg-orange-900/20 px-4 py-2 text-orange-800 dark:text-orange-200 text-sm">
              <p>Viewing text content using iframe</p>
            </div>
            <iframe 
              src={contentUrl}
              className="w-full h-[400px] border-0"
              sandbox="allow-scripts allow-same-origin"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            
            {imageError && (
              <div className="p-4 text-center text-sm text-red-500 dark:text-red-400">
                Failed to load text content
                <div className="mt-2">
                  <a
                    href={contentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-orange-600 dark:bg-orange-700 text-white text-sm rounded hover:bg-orange-700 dark:hover:bg-orange-800"
                  >
                    <ExternalLink className="inline h-3 w-3 mr-1" />
                    Open in New Tab
                  </a>
                </div>
              </div>
            )}
          </div>
        );
      }
      
      return (
        <div className="flex items-center justify-center h-40 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400">No content available</p>
        </div>
      );
    }

    // For JSON content
    if (resource.contentType.includes('application/json')) {
      // If content is a URL or content is empty, use an iframe
      if (typeof resource.content === 'string' && (
          resource.content.startsWith('http') || 
          !resource.content || 
          resource.content === '{}'
        ) && (resource.didReference || resource.inscriptionId)
      ) {
        // Use DID reference if available, otherwise fall back to inscription ID
        const contentIdentifier = resource.didReference || resource.inscriptionId;
        
        return (
          <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
            <div className="relative h-96 bg-white dark:bg-gray-900">
              <iframe 
                src={apiService.getContentUrl(contentIdentifier)}
                className="w-full h-full"
                onLoad={() => setImageLoaded(false)}
                onError={() => setImageError(true)}
              />
            </div>
          </div>
        );
      }
      
      // For actual JSON content
      let formattedJson = '';
      
      if (typeof resource.content === 'string') {
        try {
          // Try to parse the JSON string and then format it
          const jsonObject = JSON.parse(resource.content);
          formattedJson = JSON.stringify(jsonObject, null, 2);
        } catch (e) {
          console.error('Error parsing JSON content:', e);
          formattedJson = resource.content; // Use the raw string if parsing fails
        }
      } else if (resource.content !== null && typeof resource.content === 'object') {
        // If it's already an object, just stringify it with formatting
        formattedJson = JSON.stringify(resource.content, null, 2);
      } else {
        formattedJson = 'Invalid JSON content';
      }
      
      return (
        <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl">
          <pre className="p-4 overflow-auto max-h-96 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {formattedJson}
          </pre>
        </div>
      );
    }
    
    // For image content
    if (resource.contentType.startsWith('image/')) {
      const imageUrl = resource.sat 
        ? apiService.getContentUrl(resource.sat)
        : (typeof resource.content === 'string' ? resource.content : '');
        
      return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="relative bg-white dark:bg-gray-900 flex items-center justify-center">
            {imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 dark:border-blue-400 rounded-full border-t-transparent"></div>
              </div>
            )}
            
            {imageError ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-4">Failed to load image</p>
                <a 
                  href={imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 rounded-md hover:bg-blue-700 dark:hover:bg-blue-800"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Open in New Tab
                </a>
              </div>
            ) : (
              <img 
                src={imageUrl}
                alt="Resource content"
                className="max-w-full"
                style={{ maxHeight: '600px' }}
                onLoad={() => setImageLoaded(false)}
                onError={() => {
                  console.error('Failed to load image', resource);
                  setImageLoaded(false);
                  setImageError(true);
                }}
              />
            )}
          </div>
        </div>
      );
    }
    
    // For unknown content types, try to render as text
    if (resource.contentType === 'unknown' || resource.contentType === '') {
      return renderTextFallback();
    }
    
    // Default for other content types
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Content type <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">{resource.contentType}</code> preview not supported
        </p>
        {resource.didReference && (
          <a 
            href={apiService.getContentUrl(resource.didReference)} 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-700 rounded-md hover:bg-blue-700 dark:hover:bg-blue-800"
          >
            <Download className="mr-2 h-4 w-4" />
            Open Content in New Tab
          </a>
        )}
      </div>
    );
  };

  // Helper function to render text content fallback using iframe
  const renderTextFallback = () => {
    // Get the appropriate identifier, preferring didReference over inscriptionId
    const contentIdentifier = resource.didReference;
    
    if (!contentIdentifier) {
      // If we don't have an identifier but have content, render it directly
      if (resource.content && typeof resource.content === 'string') {
        return (
          <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 rounded-xl">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200">
              {resource.content}
            </pre>
          </div>
        );
      }
      
      return (
        <div className="flex items-center justify-center h-40 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <p className="text-gray-500 dark:text-gray-400">No text content available</p>
        </div>
      );
    }
    
    // Use iframe as fallback for text content
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="relative h-96 bg-white dark:bg-gray-900">
          <iframe 
            src={apiService.getContentUrl(contentIdentifier)}
            className="w-full h-full"
            onLoad={() => setImageLoaded(false)}
            onError={() => setImageError(true)}
          />
        </div>
      </div>
    );
  };

  const getResourceTypeClass = () => {
    switch (resource.resourceType?.toLowerCase()) {
      case 'profile':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'avatar':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'banner':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      case 'credential':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'verification':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300';
      case 'document':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      case 'identity':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'image':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
      case 'did':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  if (expanded) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1.5">
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${getResourceTypeClass()}`}>
                  {resource.resourceType || 'Unknown'}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {resource.contentType || 'Unknown content type'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 truncate">
                  Resource {truncateMiddle(formatDid(), 8, 8)}
                </h3>
                <button
                  className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(formatDid());
                  }}
                  title="Copy resource ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-2">
                {resource.didReference && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Related to DID: <span className="font-mono text-gray-600 dark:text-gray-300">{truncateMiddle(resource.didReference, 8, 8)}</span>
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  Inscription ID: <a href={getInscriptionLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-mono flex items-center gap-1">
                    {truncateMiddle(resource.inscriptionId, 8, 8)}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 mr-1" /> 
                  Created: {formatTimeAgo(new Date(resource.createdAt))}
                </p>
              </div>
            </div>
          </div>
        </div>
        {renderResourceContent()}
      </div>
    );
  }

  // Grid view
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden w-full h-full flex flex-col transform transition-transform hover:translate-y-[-4px] hover:shadow-md">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${getResourceTypeClass()}`}>
            <span className="truncate max-w-[100px]">{resource.resourceType || 'Unknown'}</span>
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeAgo(new Date(resource.createdAt))}
          </span>
        </div>
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate mb-1">
            {truncateMiddle(formatDid(), 8, 4)}
          </h3>
          <button
            className="h-5 w-5 p-0 -mt-0.5 -mr-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            onClick={(e) => {
              e.preventDefault();
              navigator.clipboard.writeText(formatDid());
            }}
            title="Copy resource ID"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex gap-1 text-xs text-gray-500 dark:text-gray-400 items-center">
          <a href={getInscriptionLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5">
            Inscription
            <ExternalLink className="h-3 w-3 ml-0.5" />
          </a>
          {resource.did && (
            <>
              <span className="text-gray-400 dark:text-gray-600">•</span>
              <span className="truncate font-mono text-gray-500 dark:text-gray-400">{truncateMiddle(resource.did, 6, 4)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800">
        {renderResourceContent()}
      </div>
    </div>
  );
};

export default LinkedResourceViewer;
