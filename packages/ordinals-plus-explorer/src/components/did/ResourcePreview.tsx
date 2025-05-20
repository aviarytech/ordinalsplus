import React, { useState, useEffect } from 'react';
import { ResourceType } from 'ordinalsplus';
import { FileText, FileImage, FileJson, File, AlertCircle, FileCode, Download, Maximize2, Minimize2 } from 'lucide-react';

interface ResourcePreviewProps {
  file: File | null;
  content: string | ArrayBuffer | null;
  contentType: string;
  resourceType: ResourceType;
  maxHeight?: string;
  showControls?: boolean;
}

/**
 * Component to preview different types of resources before upload
 */
const ResourcePreview: React.FC<ResourcePreviewProps> = ({
  file,
  content,
  contentType,
  resourceType,
  maxHeight = '16rem',
  showControls = true
}) => {
  // State for expanded view
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [errorLoading, setErrorLoading] = useState<boolean>(false);
  
  // Reset error state when content changes
  useEffect(() => {
    setErrorLoading(false);
  }, [content]);
  if (!file || !content) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <AlertCircle className="h-10 w-10 text-gray-400 dark:text-gray-500 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">No file selected for preview</p>
      </div>
    );
  }

  // Helper to determine if content is a data URL
  const isDataUrl = (content: string | ArrayBuffer): boolean => {
    if (typeof content !== 'string') return false;
    return content.startsWith('data:');
  };

  // Helper to get content as string
  const getContentAsString = (): string => {
    if (typeof content === 'string') {
      return content;
    } else if (content instanceof ArrayBuffer) {
      return new TextDecoder().decode(content);
    }
    return '';
  };

  // Render image preview
  const renderImagePreview = () => {
    const imgSrc = typeof content === 'string' && isDataUrl(content) 
      ? content 
      : URL.createObjectURL(file);
    
    return (
      <div className="flex flex-col items-center w-full">
        <div className={`bg-white dark:bg-gray-800 p-2 rounded-lg shadow-sm mb-2 max-w-full overflow-hidden relative ${isExpanded ? 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80' : ''}`}>
          {showControls && (
            <div className="absolute top-2 right-2 flex space-x-1 z-10">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="p-1 bg-white/80 dark:bg-gray-800/80 rounded-full hover:bg-white dark:hover:bg-gray-700 transition-colors"
                aria-label={isExpanded ? 'Minimize image' : 'Maximize image'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" /> : <Maximize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />}
              </button>
              <a 
                href={imgSrc} 
                download={file.name}
                className="p-1 bg-white/80 dark:bg-gray-800/80 rounded-full hover:bg-white dark:hover:bg-gray-700 transition-colors"
                onClick={(e) => e.stopPropagation()}
                aria-label="Download image"
              >
                <Download className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              </a>
            </div>
          )}
          <img 
            src={imgSrc} 
            alt={file.name} 
            className={`${isExpanded ? 'max-h-[90vh] max-w-[90vw]' : `max-h-[${maxHeight}]`} max-w-full object-contain`}
            onLoad={() => {
              // Clean up object URL if we created one
              if (typeof content !== 'string' || !isDataUrl(content)) {
                URL.revokeObjectURL(imgSrc);
              }
              setErrorLoading(false);
            }}
            onError={() => {
              setErrorLoading(true);
              // Clean up object URL if we created one
              if (typeof content !== 'string' || !isDataUrl(content)) {
                URL.revokeObjectURL(imgSrc);
              }
            }}
          />
          {errorLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
              <div className="text-center p-4">
                <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-300">Error loading image</p>
              </div>
            </div>
          )}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
          {file.name} • {Math.round(file.size / 1024)} KB
        </div>
      </div>
    );
  };

  // Render JSON preview
  const renderJsonPreview = () => {
    let formattedJson = '';
    let isValidJson = true;
    
    try {
      const jsonContent = getContentAsString();
      const parsedJson = JSON.parse(jsonContent);
      formattedJson = JSON.stringify(parsedJson, null, 2);
    } catch (e) {
      formattedJson = 'Invalid JSON format: ' + (e instanceof Error ? e.message : String(e));
      isValidJson = false;
    }

    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <FileJson className="h-5 w-5 text-blue-500 mr-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
          </div>
          {showControls && isValidJson && (
            <div className="flex space-x-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label={isExpanded ? 'Show less' : 'Show more'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" /> : <Maximize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />}
              </button>
            </div>
          )}
        </div>
        <pre 
          className={`bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto text-xs text-gray-800 dark:text-gray-200 ${isExpanded ? 'max-h-[60vh]' : `max-h-[${maxHeight}]`}`}
          style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          <code className="language-json">{formattedJson}</code>
        </pre>
      </div>
    );
  };

  // Render text preview
  const renderTextPreview = () => {
    const textContent = getContentAsString();
    
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
          </div>
          {showControls && (
            <div className="flex space-x-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label={isExpanded ? 'Show less' : 'Show more'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" /> : <Maximize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />}
              </button>
              <a 
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(textContent)}`} 
                download={file.name}
                className="p-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Download text"
              >
                <Download className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              </a>
            </div>
          )}
        </div>
        <pre 
          className={`bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto text-xs text-gray-800 dark:text-gray-200 ${isExpanded ? 'max-h-[60vh]' : `max-h-[${maxHeight}]`}`}
          style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          {textContent}
        </pre>
      </div>
    );
  };

  // Render schema preview (special case for JSON Schema)
  const renderSchemaPreview = () => {
    return renderJsonPreview();
  };
  
  // Render code preview (for HTML, CSS, JS, etc.)
  const renderCodePreview = () => {
    const codeContent = getContentAsString();
    let language = 'plaintext';
    
    // Determine language based on file extension or content type
    if (file) {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (extension) {
        switch (extension) {
          case 'html': language = 'html'; break;
          case 'css': language = 'css'; break;
          case 'js': case 'mjs': case 'cjs': language = 'javascript'; break;
          case 'ts': language = 'typescript'; break;
          case 'jsx': language = 'jsx'; break;
          case 'tsx': language = 'tsx'; break;
          case 'md': case 'markdown': language = 'markdown'; break;
          case 'yml': case 'yaml': language = 'yaml'; break;
          case 'xml': case 'svg': language = 'xml'; break;
          case 'py': language = 'python'; break;
          case 'rb': language = 'ruby'; break;
          case 'go': language = 'go'; break;
          case 'rs': language = 'rust'; break;
          case 'java': language = 'java'; break;
          case 'c': case 'h': language = 'c'; break;
          case 'cpp': case 'hpp': case 'cc': language = 'cpp'; break;
          case 'cs': language = 'csharp'; break;
          case 'php': language = 'php'; break;
          case 'swift': language = 'swift'; break;
          case 'kt': case 'kts': language = 'kotlin'; break;
          case 'sh': case 'bash': language = 'bash'; break;
          case 'sql': language = 'sql'; break;
          default: language = 'plaintext';
        }
      }
    }
    
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <FileCode className="h-5 w-5 text-indigo-500 mr-2" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{file.name}</span>
            <span className="ml-2 text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">{language}</span>
          </div>
          {showControls && (
            <div className="flex space-x-1">
              <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label={isExpanded ? 'Show less' : 'Show more'}
              >
                {isExpanded ? <Minimize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" /> : <Maximize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />}
              </button>
              <a 
                href={`data:text/plain;charset=utf-8,${encodeURIComponent(codeContent)}`} 
                download={file.name}
                className="p-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                aria-label="Download code"
              >
                <Download className="h-4 w-4 text-gray-700 dark:text-gray-300" />
              </a>
            </div>
          )}
        </div>
        <pre 
          className={`bg-gray-50 dark:bg-gray-800 p-4 rounded-lg overflow-auto text-xs text-gray-800 dark:text-gray-200 ${isExpanded ? 'max-h-[60vh]' : `max-h-[${maxHeight}]`}`}
          style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
        >
          <code className={`language-${language}`}>{codeContent}</code>
        </pre>
      </div>
    );
  };

  // Render generic file preview
  const renderGenericPreview = () => {
    return (
      <div className="flex flex-col items-center">
        <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-2">
          <File className="h-12 w-12 text-gray-400 dark:text-gray-500" />
        </div>
        <div className="text-sm text-gray-700 dark:text-gray-300 font-medium">
          {file.name}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {contentType || 'Unknown type'} • {Math.round(file.size / 1024)} KB
        </div>
        {showControls && (
          <a 
            href={URL.createObjectURL(file)} 
            download={file.name}
            className="mt-2 text-xs flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
            onClick={() => {
              // We create the URL on demand, so we don't need to revoke it
              // as it will be garbage collected
            }}
          >
            <Download className="h-3 w-3 mr-1" /> Download
          </a>
        )}
      </div>
    );
  };

  // Determine which preview to render based on content type and resource type
  if (contentType.startsWith('image/')) {
    return renderImagePreview();
  } else if (contentType === 'application/json' || contentType.endsWith('+json')) {
    return renderJsonPreview();
  } else if (contentType.startsWith('text/')) {
    if (contentType === 'text/html') {
      return renderCodePreview();
    } else if (contentType === 'text/css') {
      return renderCodePreview();
    } else if (contentType === 'text/javascript' || contentType === 'application/javascript') {
      return renderCodePreview();
    } else {
      return renderTextPreview();
    }
  } else if (resourceType === ResourceType.SCHEMA) {
    return renderSchemaPreview();
  } else if (contentType === 'application/xml' || contentType === 'text/xml') {
    return renderCodePreview();
  } else if (file && file.name) {
    // Check file extension for code files
    const extension = file.name.split('.').pop()?.toLowerCase();
    const codeExtensions = ['html', 'css', 'js', 'ts', 'jsx', 'tsx', 'md', 'markdown', 'yml', 'yaml', 'xml', 'svg', 
                            'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'hpp', 'cc', 'cs', 'php', 'swift', 
                            'kt', 'kts', 'sh', 'bash', 'sql'];
    if (extension && codeExtensions.includes(extension)) {
      return renderCodePreview();
    } else {
      return renderGenericPreview();
    }
  } else {
    return renderGenericPreview();
  }
};

export default ResourcePreview;
