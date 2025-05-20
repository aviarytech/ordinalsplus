import React from 'react';

export interface ContentPreviewProps {
  preview: string;
  type: string;
  className?: string;
}

/**
 * A component for previewing content before inscription
 */
const ContentPreview: React.FC<ContentPreviewProps> = ({
  preview,
  type,
  className = '',
}) => {
  if (!preview) return null;

  // Determine if the content is an image
  const isImage = 
    type === 'file' && preview.startsWith('data:image/') || 
    type.startsWith('image/');

  // Determine if the content is JSON
  const isJson = type === 'application/json' || 
    (typeof preview === 'string' && preview.trim().startsWith('{') && preview.trim().endsWith('}'));

  // Format JSON for display if needed
  const formatJsonContent = (content: string): string => {
    try {
      if (isJson) {
        // Parse and stringify with indentation
        return JSON.stringify(JSON.parse(content), null, 2);
      }
      return content;
    } catch (e) {
      // If parsing fails, return the original content
      return content;
    }
  };

  // Truncate text content if it's too long
  const truncateContent = (content: string, maxLength = 500): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className={`content-preview mt-4 ${className}`}>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview</h3>
      
      <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
        {isImage ? (
          <div className="flex justify-center p-2 bg-gray-50 dark:bg-gray-800">
            <img 
              src={preview} 
              alt="Content preview" 
              className="max-h-40 object-contain" 
            />
          </div>
        ) : (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 overflow-auto max-h-60">
            <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {truncateContent(formatJsonContent(preview))}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentPreview;
