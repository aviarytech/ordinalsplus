import React, { useEffect, useState } from 'react';
import { Button } from 'av1-c';
import { formatTimeAgo } from '../utils/date';
import { truncateMiddle } from '../utils/string';
import JSONFormatter from './JSONFormatter';
import { LinkedResource as ProjectLinkedResource } from '../types';
import { Copy, ExternalLink, Clock } from 'lucide-react';

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
  const [showFullJson, setShowFullJson] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isJsonContent = 
    (resource.contentType && resource.contentType.includes('json')) || 
    (typeof resource.content === 'object' && resource.content !== null);

  // Handle content preview with improved type checking
  const contentPreview = isJsonContent 
    ? typeof resource.content === 'string' 
      ? resource.content 
      : JSON.stringify(resource.content, null, 2)
    : typeof resource.content === 'string' 
      ? resource.content 
      : '';

  const truncatedContent = contentPreview.length > 100 
    ? `${contentPreview.substring(0, 100)}...` 
    : contentPreview;

  const isImage = resource.contentType && resource.contentType.includes('image');
  const isText = (resource.contentType && resource.contentType.includes('text')) || isJsonContent;
  const isAudio = resource.contentType && resource.contentType.includes('audio');
  const isVideo = resource.contentType && resource.contentType.includes('video');

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

  const getInscriptionLink = () => {
    return `https://ordiscan.com/inscription/${resource.inscriptionId}`;
  };

  const renderResourceContent = () => {
    if (jsonOnly && !isJsonContent) {
      return (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400 italic">
          Non-JSON content filtered
        </div>
      );
    }

    if (isImage) {
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
          
          {/* Handle both data URLs and direct Ord node URLs */}
          {typeof resource.content === 'string' && (
            <img 
              src={resource.content} 
              alt={`Resource ${resource.resourceId}`}
              className={`max-h-60 object-contain rounded-md ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity ${expanded ? 'max-w-md' : 'max-w-full'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}
        </div>
      );
    }

    if (isText) {
      return (
        <div className="p-4 max-h-60 overflow-auto text-sm bg-gray-50 dark:bg-gray-800 rounded-md">
          {isJsonContent ? (
            <>
              <JSONFormatter
                json={resourceContent || {}}
                expanded={showFullJson || expanded}
              />
              {!showFullJson && contentPreview.length > 100 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => setShowFullJson(true)}
                >
                  Show Full JSON
                </Button>
              )}
            </>
          ) : (
            <pre className="whitespace-pre-wrap break-words">{truncatedContent}</pre>
          )}
        </div>
      );
    }

    if (isAudio) {
      return (
        <div className="p-4 flex justify-center">
          <audio controls className="w-full max-w-md">
            <source src={typeof resource.content === 'string' ? resource.content : ''} type={resource.contentType} />
            Your browser does not support the audio element.
          </audio>
        </div>
      );
    }

    if (isVideo) {
      return (
        <div className="p-4 flex justify-center">
          <video controls className="w-full max-w-md max-h-60">
            <source src={typeof resource.content === 'string' ? resource.content : ''} type={resource.contentType} />
            Your browser does not support the video element.
          </video>
        </div>
      );
    }

    return (
      <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Content preview not available</p>
        <p className="text-xs mt-1">Content type: {resource.contentType || 'Unknown'}</p>
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
                  Resource {truncateMiddle(resource.resourceId, 8, 8)}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 p-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                  onClick={() => navigator.clipboard.writeText(resource.resourceId)}
                  title="Copy resource ID"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
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
            {truncateMiddle(resource.resourceId, 8, 4)}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 p-0 -mt-0.5 -mr-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            onClick={() => navigator.clipboard.writeText(resource.resourceId)}
            title="Copy resource ID"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
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
