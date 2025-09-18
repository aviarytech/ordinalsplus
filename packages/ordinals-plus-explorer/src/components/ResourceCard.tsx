import React, { useState, useEffect } from 'react';
import { FileText, Code, Image } from 'lucide-react';
import { LinkedResource } from 'ordinalsplus';
import { StatusBadge } from './verification';
import { VerificationStatus } from '../types/verification';

interface ResourceCardProps {
  resource: LinkedResource;
  onClick: () => void;
  isSelected: boolean;
  verificationStatus?: VerificationStatus;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onClick, isSelected, verificationStatus }) => {
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [textLoading, setTextLoading] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);
  
  useEffect(() => {
    // Try to fetch text content directly for any resource that could be text
    const fetchTextForUnknownTypes = async () => {
      if (
        (resource.contentType?.includes('text/') || 
         resource.contentType === 'unknown' || 
         resource.contentType === '')
      ) {
        setTextLoading(true);
        setTextError(null);
        
        try {
          if (resource.content_url) {
            const response = await fetch(resource.content_url);
            const text = await response.text();
            setPreviewText(text);
          }
        } catch (error) {
          console.error('Error fetching text content:', error);
          setTextError(error instanceof Error ? error.message : 'Unknown error');
        } finally {
          setTextLoading(false);
        }
      }
    };
    
    fetchTextForUnknownTypes();
  }, [resource.content_url, resource.contentType]);
  
  // Helper to get border style based on content type
  const getBorderColorClass = () => {
    if (resource.contentType?.includes('image/')) {
      return 'border-pink-500 dark:border-pink-600';
    } else if (resource.contentType?.includes('application/json')) {
      return 'border-blue-500 dark:border-blue-600';
    } else if (resource.contentType?.includes('text/') || resource.contentType === 'unknown') {
      return 'border-green-500 dark:border-green-600';
    } else {
      return 'border-gray-300 dark:border-gray-600';
    }
  };

  // Helper to render content preview based on content type
  const renderPreview = () => {
    // Show loading state if we're fetching text content
    if (textLoading) {
      return (
        <div className="flex items-center justify-center p-4 text-gray-500 dark:text-gray-400">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading content...
        </div>
      );
    }
    
    // Show error state if there was an error
    if (textError) {
      return (
        <div className="p-2 text-sm text-red-500 dark:text-red-400">
          Error loading content
        </div>
      );
    }
    
    // If HTML content, use iframe preview
    if (resource.contentType.includes('text/html') && resource.content_url) {
      return (
        <div className="relative w-full pt-[100%] border-t border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-700">
          <iframe
            src={resource.content_url}
            title={`Preview ${resource.id}`}
            className="absolute inset-0 w-full h-full"
            sandbox="allow-scripts allow-same-origin"
          />
        </div>
      );
    }

    // For text content we fetched successfully, show a preview snippet
    if (previewText && resource.contentType !== 'text/html') {
      const previewLength = 100;
      const displayText = previewText.length > previewLength
        ? previewText.substring(0, previewLength) + '...'
        : previewText;
      return (
        <div className="p-2 text-sm font-mono overflow-hidden">
          {displayText}
        </div>
      );
    }
    
    // For image content
    if (resource.contentType?.startsWith('image/')) {
      return resource.content_url ? (
        <div className="relative w-full pt-[100%] bg-gray-100 dark:bg-gray-800">
          <img 
            src={resource.content_url} 
            alt="Resource preview" 
            className="absolute inset-0 w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const placeholder = e.currentTarget.nextElementSibling as HTMLElement | null;
              if (placeholder) placeholder.classList.remove('hidden');
            }}
          />
          <span className="hidden absolute inset-0 flex items-center justify-center text-xs text-gray-500">Image not available</span>
        </div>
      ) : (
        <div className="p-2 text-sm text-gray-500 dark:text-gray-400">
          Image preview not available
        </div>
      );
    }
    
    // For JSON content
    if (resource.contentType?.includes('application/json')) {
      return (
        <div className="p-2 text-xs font-mono text-blue-600 dark:text-blue-400 overflow-hidden">
          JSON data
        </div>
      );
    }
    
    // Default for other content types
    return (
      <div className="p-2 text-sm text-gray-500 dark:text-gray-400">
        {resource.contentType || 'Unknown content type'}
      </div>
    );
  };

  // Color class for the resource type icon
  const getIconColorClass = () => {
    if (resource.contentType?.startsWith('image/')) {
      return 'text-pink-500';
    } else if (resource.contentType?.includes('application/json')) {
      return 'text-blue-500';
    } else if (resource.contentType?.includes('text/') || resource.contentType === 'unknown' || resource.contentType === '') {
      return 'text-green-500';
    } else {
      return 'text-gray-500';
    }
  };

  // Determine which icon to use based on content type
  const getResourceIcon = () => {
    if (resource.contentType?.startsWith('image/')) {
      return <Image className={`h-5 w-5 ${getIconColorClass()}`} />;
    } else if (resource.contentType?.includes('application/json')) {
      return <Code className={`h-5 w-5 ${getIconColorClass()}`} />;
    } else if (resource.contentType?.includes('text/') || resource.contentType === 'unknown' || resource.contentType === '') {
      return <FileText className={`h-5 w-5 ${getIconColorClass()}`} />;
    } else {
      return <FileText className={`h-5 w-5 ${getIconColorClass()}`} />;
    }
  };

  return (
    <div
      className={`border ${getBorderColorClass()} rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
        isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''
      }`}
      onClick={onClick}
    >
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          {getResourceIcon()}
          <h3 className="text-sm font-medium truncate">
            {resource.id}
          </h3>
        </div>
        {verificationStatus && (
          <StatusBadge 
            status={verificationStatus} 
            showText={false}
            size="sm"
          />
        )}
      </div>
      
      {renderPreview()}
      
      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 text-xs text-gray-500 dark:text-gray-400 rounded-b-lg">
        {resource.contentType || 'Unknown type'}
      </div>
    </div>
  );
};

export default ResourceCard; 