import React, { useState } from 'react';
import { Download } from 'lucide-react';

interface ResourceCardProps {
  content: unknown;
  contentType: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ content, contentType }) => {
  const [isImageLoading, setIsImageLoading] = useState<boolean>(true);
  const [imageError, setImageError] = useState<boolean>(false);

  const renderContent = () => {
    if (!content) {
      return (
        <div className="p-4 text-gray-500 dark:text-gray-400 text-center italic">
          No content available
        </div>
      );
    }
    
    // JSON content
    if (contentType.includes('application/json')) {
      return (
        <div className="p-4">
          <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-auto max-h-[30rem] text-sm font-mono text-gray-800 dark:text-gray-200 break-all whitespace-pre-wrap">
            {typeof content === 'string' ? content : JSON.stringify(content, null, 2)}
          </pre>
        </div>
      );
    }
    
    // Image content
    if (contentType.startsWith('image/')) {
      const imageUrl = typeof content === 'string' ? content : URL.createObjectURL(new Blob([content as BlobPart]));
      
      return (
        <div className="p-4">
          <div className="relative bg-gray-50 dark:bg-gray-900 rounded-md overflow-hidden flex justify-center items-center">
            {isImageLoading && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
              </div>
            )}
            
            {imageError ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 mb-2">Failed to load image</p>
                <a 
                  href={imageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Open Image in New Tab
                </a>
              </div>
            ) : (
              <img 
                src={imageUrl}
                alt="Resource content"
                className="max-w-full rounded-md"
                style={{ maxHeight: '500px' }}
                onLoad={() => setIsImageLoading(false)}
                onError={() => {
                  setIsImageLoading(false);
                  setImageError(true);
                }}
              />
            )}
          </div>
          
          <div className="mt-4 flex justify-end">
            <a
              href={imageUrl}
              download={`resource-${Date.now()}.${contentType.split('/')[1] || 'png'}`}
              className="inline-flex items-center px-3 py-1 border border-gray-300 dark:border-gray-600 text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </a>
          </div>
        </div>
      );
    }
    
    // HTML content
    if (contentType.includes('text/html')) {
      return (
        <div className="p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-4 overflow-auto max-h-[30rem]">
            <div dangerouslySetInnerHTML={{ __html: content as string }} />
          </div>
        </div>
      );
    }
    
    // Plain text
    if (contentType.includes('text/plain')) {
      return (
        <div className="p-4">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md overflow-auto max-h-[30rem] whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200 break-all">
            {content as string}
          </div>
        </div>
      );
    }
    
    // Default fallback for other content types
    return (
      <div className="p-4">
        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-md text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Content type <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">{contentType}</code> not supported for preview
          </p>
          <a 
            href={typeof content === 'string' ? content : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
          >
            Open Content
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-md overflow-hidden">
      {renderContent()}
    </div>
  );
};

export default ResourceCard; 