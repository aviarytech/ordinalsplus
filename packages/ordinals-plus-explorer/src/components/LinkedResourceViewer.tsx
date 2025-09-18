import React, { useEffect, useState } from 'react';
import { formatTimeAgo } from '../utils/date';
import { truncateMiddle } from '../utils/string';
import JSONFormatter from './JSONFormatter';
import { Copy, ExternalLink, Clock, Download } from 'lucide-react';
import ApiServiceProvider from '../services/ApiServiceProvider';
import { LinkedResource } from 'ordinalsplus';
import { VerificationComponent } from './verification';
import { VerificationService } from '../services/verificationService';
import { useNetwork } from '../context/NetworkContext';
// Component-specific interface that matches what we're actually using
interface LinkedResourceViewProps {
  resource: LinkedResource; // Use the project's LinkedResource type
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
  const [verificationService] = useState<VerificationService>(() => {
    const apiServiceInstance = ApiServiceProvider.getInstance();
    return new VerificationService(apiServiceInstance, { enableDebugLogging: false });
  });

  const { network: activeNetwork } = useNetwork();

  const isJsonContent = resource.contentType?.includes('json') || false;

  useEffect(() => {
    const fetchContent = async () => {
      if (isJsonContent && resource.content_url) {
        try {
          const response = await fetch(resource.content_url);
          const data = await response.json();
          setResourceContent(data);
        } catch (error) {
          console.error('Error fetching JSON content:', error);
          setResourceContent(null);
        }
      }
    };

    fetchContent();
  }, [resource.content_url, isJsonContent]);

  // Add new effect to fetch text content directly
  useEffect(() => {
    const fetchTextContent = async () => {
      if (
        resource.inscriptionId && 
        // For generic text but NOT HTML, fetch and show as text
        (resource.contentType?.includes('text/') && resource.contentType !== 'text/html' || 
         resource.contentType === 'unknown' ||
         resource.contentType === '')
      ) {
        setTextLoading(true);
        setTextError(false);
        
        try {
          const response = await fetch(resource.content_url);
          const text = await response.text();
          setFetchedText(text);
        } catch (error) {
          console.error('Error fetching text content:', error);
          setTextError(true);
        } finally {
          setTextLoading(false);
        }
      }
    };
    
    fetchTextContent();
  }, [resource.inscriptionId, resource.contentType, resource.content_url]);

  const getInscriptionLink = () => {
    return `https://ordiscan.com/inscription/${resource.inscriptionId}`;
  };

  // Format a DID using sat number and inscription index and prefix by network when applicable
  const formatDid = (): string => {
    if (resource.sat) {
      // Extract inscription index from inscriptionId
      const match = resource.inscriptionId?.match(/i(\d+)$/);
      const index = match && match[1] ? match[1] : '0';
      const netPrefix = activeNetwork?.type === 'testnet' ? 'test:' : activeNetwork?.type === 'signet' ? 'sig:' : '';
      return `did:btco:${netPrefix}${resource.sat}/${index}`;
    }
    // For backwards compatibility only - log warning
    console.warn('Resource missing sat number, cannot create proper DID format');
    const netPrefix = activeNetwork?.type === 'testnet' ? 'test:' : activeNetwork?.type === 'signet' ? 'sig:' : '';
    return resource.didReference || `did:btco:${netPrefix}${resource.inscriptionId}`;
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

    // HTML content should be rendered via iframe
    if (resource.contentType === 'text/html' && resource.content_url) {
      return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="relative h-96 bg-white dark:bg-gray-900">
            <iframe
              src={resource.content_url}
              className="w-full h-full"
              sandbox="allow-scripts allow-same-origin"
              title={`HTML content ${resource.inscriptionId}`}
            />
          </div>
        </div>
      );
    }

    // Add check for fetched text content (non-HTML)
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

    if (resource.contentType?.includes('image')) {      
      return (
        <div className={`relative ${expanded ? 'w-full' : 'w-full'} ${expanded ? 'py-4' : ''}`}>
          <div className={`${expanded ? 'max-w-md mx-auto' : ''} relative w-full ${expanded ? 'pt-[100%]' : 'pt-[100%]'} bg-gray-50 dark:bg-gray-700 rounded-md`}>
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center animate-pulse">
                <span className="text-sm text-gray-500">Loading...</span>
              </div>
            )}
            {imageError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm text-gray-500 dark:text-gray-400">Image failed to load</span>
              </div>
            )}
            <img 
              src={resource.content_url} 
              alt={`Resource ${resource.inscriptionId}`}
              className={`absolute inset-0 w-full h-full object-contain rounded-md ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                console.error(`Failed to load image for inscription ${resource.inscriptionId}`);
                setImageError(true);
              }}
            />
          </div>
        </div>
      );
    }

    if (resource.contentType?.includes('text') && resource.contentType !== 'text/html') {
      return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-md overflow-auto max-h-[30rem]">
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
            {fetchedText || 'Loading text content...'}
          </pre>
          {resource.content_url && (
            <div className="mt-4 flex justify-end">
              <a
                href={resource.content_url}
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

    if (resource.contentType?.includes('audio')) {
      return (
        <div className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 rounded-xl">
          <audio 
            controls 
            className="w-full" 
            src={resource.content_url}
            onError={() => {
              console.error('Failed to load audio', resource);
            }}
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    if (resource.contentType?.includes('video')) {
      return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <video 
            controls 
            className="w-full" 
            src={resource.content_url}
            onError={() => {
              console.error('Failed to load video', resource);
            }}
          >
            Your browser does not support the video element.
          </video>
        </div>
      );
    }

    // For unknown content types, try to render as text
    if (resource.contentType === 'unknown' || resource.contentType === '') {
      return (
        <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="relative h-96 bg-white dark:bg-gray-900">
            <iframe 
              src={resource.content_url}
              className="w-full h-full"
              onLoad={() => setImageLoaded(false)}
              onError={() => setImageError(true)}
            />
          </div>
        </div>
      );
    }
    
    // Default for other content types
    return (
      <div className="flex flex-col items-center justify-center h-40 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Content type <code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">{resource.contentType}</code> preview not supported
        </p>
        {resource.content_url && (
          <a 
            href={resource.content_url} 
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

  const getResourceTypeClass = () => {
    switch (resource.type?.toLowerCase()) {
      case 'profile':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'avatar':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'banner':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      case 'credential':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'verification':
        return (
          <div className="flex flex-col space-y-4 md:space-y-6 mt-6">
            {resource.inscriptionId && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
                <h3 className="text-lg font-medium mb-4">Verification</h3>
                <VerificationComponent
                  inscriptionId={resource.inscriptionId}
                  verificationService={verificationService}
                  autoVerify={true}
                />
              </div>
            )}
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-medium mb-4">Resource Content</h3>
              {renderResourceContent()}
            </div>
          </div>
        );
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
                  {resource.type || 'Unknown'}
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
                  Created: {formatTimeAgo(new Date())}
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
            <span className="truncate max-w-[100px]">{resource.type || 'Unknown'}</span>
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {formatTimeAgo(new Date())}
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
          {resource.didReference && (
            <>
              <span className="text-gray-400 dark:text-gray-600">•</span>
              <span className="truncate font-mono text-gray-500 dark:text-gray-400">{truncateMiddle(resource.didReference, 6, 4)}</span>
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
