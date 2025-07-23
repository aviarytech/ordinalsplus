import React, { useState, useRef } from 'react';
import { useResourceInscription } from './ResourceInscriptionWizard';
import { Button } from '../ui';
import { Upload, FileText } from 'lucide-react';

// Define supported content types
const supportedContentTypes = [
  { mime: 'text/plain', label: 'Text', isText: true },
  { mime: 'application/json', label: 'JSON', isText: true },
  { mime: 'image/png', label: 'PNG Image', isText: false },
  { mime: 'image/jpeg', label: 'JPEG Image', isText: false },
  { mime: 'image/gif', label: 'GIF Image', isText: false },
  { mime: 'image/svg+xml', label: 'SVG Image', isText: false },
];

/**
 * ContentSelectionStep handles the selection and configuration of content for resource inscription.
 */
const ContentSelectionStep: React.FC = () => {
  const { state, setContentData, nextStep, previousStep, validationErrors, validateFormField, setError, clearError } = useResourceInscription();
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isTextContent, setIsTextContent] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local state for form handling
  const [contentType, setContentType] = useState<string>(state.contentData.type || 'text/plain');
  const [content, setContent] = useState<string>(state.contentData.content || '');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(state.contentData.preview || null);
  
  // Ensure content type is set in state when component mounts and clear any errors
  React.useEffect(() => {
    // Always set the content type when component mounts to ensure it's in the state
    setContentData({
      type: contentType,
      content: state.contentData.content || content,
      preview: state.contentData.preview || filePreview
    });
    
    // Clear all errors on component mount to prevent showing errors initially
    clearError('contentType');
    clearError('content');
    clearError('file');
  }, []);

  // Update isTextContent when content type changes
  React.useEffect(() => {
    const selectedType = supportedContentTypes.find(type => type.mime === contentType);
    setIsTextContent(selectedType?.isText || false);
  }, [contentType]);

  // Handle content type change
  const handleContentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newContentType = e.target.value;
    setContentType(newContentType);
    
    // Clear content if switching between text and non-text
    const newIsText = supportedContentTypes.find(type => type.mime === newContentType)?.isText || false;
    if (newIsText !== isTextContent) {
      setContent('');
      setFile(null);
      setFilePreview(null);
      setUploadedFileName(null);
    }
    
    // Update content type in state immediately
    setContentData({
      type: newContentType,
      content: newIsText !== isTextContent ? '' : content,
      preview: newIsText !== isTextContent ? null : filePreview
    });
    
    // Clear any content type errors
    if (validationErrors.contentType) {
      clearError('contentType');
    }
  };

  // Handle text content change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Update content in state immediately to prevent validation issues
    setContentData({
      type: contentType,
      content: newContent,
      preview: filePreview
    });
    
    // Only validate non-empty content to prevent premature errors
    if (newContent.trim() !== '') {
      validateContent(newContent);
    } else {
      clearError('content');
    }
  };

  // Process the selected file
  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setUploadedFileName(selectedFile.name);
    
    // Read file content
    const reader = new FileReader();
    
    reader.onload = (e) => {
      // IMPORTANT: Don't call toString() on a result that's already a string
      // FileReader.readAsDataURL already returns a string
      const result = e.target?.result;
      
      console.log('[DEBUG processFile] File loaded successfully');
      console.log(`[DEBUG processFile] Result type: ${typeof result}`);
      console.log(`[DEBUG processFile] File type: ${selectedFile.type}`);
      
      if (result) {
        // For both text and binary files, the result will be a string
        // - For text files via readAsText: a normal text string
        // - For binary files via readAsDataURL: a data URL string
        const contentStr = typeof result === 'string' ? result : '';
        
        console.log(`[DEBUG processFile] Content length: ${contentStr.length}`);
        if (contentStr.length > 0) {
          console.log(`[DEBUG processFile] Content starts with: ${contentStr.substring(0, 30)}...`);
        }
        
        // Store the result directly
        setContent(contentStr);
        setFilePreview(contentStr);
        setShowPreview(true);
        
        // Update content in parent state immediately to prevent validation issues
        setContentData({
          type: selectedFile.type,
          content: contentStr,
          preview: contentStr
        });
        
        validateContent(contentStr);
      } else {
        console.error('[DEBUG processFile] File read resulted in null or undefined');
        setError('file', 'Error reading file: empty content');
      }
    };
    
    reader.onerror = (error) => {
      console.error('[DEBUG processFile] Error reading file:', error, reader.error);
      setError('file', `Error reading file: ${reader.error?.message || 'Unknown error'}`);
    };
    
    console.log(`[DEBUG processFile] Starting to read file: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
    
    // Read as text or data URL based on file type
    if (selectedFile.type.startsWith('text/') || selectedFile.type === 'application/json') {
      console.log('[DEBUG processFile] Reading as text');
      reader.readAsText(selectedFile);
    } else {
      console.log('[DEBUG processFile] Reading as data URL');
      reader.readAsDataURL(selectedFile);
    }
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Validate file selection
  const validateFile = (selectedFile: File) => {
    const maxSize = 10 * 1024 * 1024; // 10MB max size
    
    // Check file size
    if (selectedFile.size > maxSize) {
      setError('file', `File size exceeds the maximum allowed (${formatFileSize(maxSize)})`);
      return false;
    }
    
    return true;
  };

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    if (!validateFile(selectedFile)) return;
    processFile(selectedFile);
  };
  
  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the dropzone (not a child element)
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (!validateFile(droppedFile)) return;
      processFile(droppedFile);
    }
  };

  // Validate content using the validation utilities
  const validateContent = (contentValue: string): boolean => {
    // Don't validate empty content on initial render
    if (contentValue === '' && state.contentData.content === null) {
      return true;
    }
    return validateFormField('content', contentValue);
  };

  // Continue to next step
  const handleContinue = () => {
    // Make sure content type is set in state before validation
    setContentData({
      type: contentType,
      content: content,
      preview: filePreview
    });
    
    // Clear any content type errors
    if (validationErrors.contentType) {
      clearError('contentType');
    }
    
    // Small delay to ensure state updates are processed before validation
    setTimeout(() => {
      if (validateContent(content)) {
        // nextStep will perform additional validation before proceeding
        nextStep();
      }
    }, 0);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
        Configure Resource Content
      </h2>
      
      <div className="space-y-4">
        {/* Content Type Selection */}
        <div>
          <label htmlFor="contentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content Type
          </label>
          <select
            id="contentType"
            value={contentType}
            onChange={handleContentTypeChange}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {supportedContentTypes.map(ct => (
              <option key={ct.mime} value={ct.mime}>
                {ct.label} ({ct.mime})
              </option>
            ))}
          </select>
        </div>
        
        {/* Content Input */}
        {isTextContent ? (
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              id="content"
              rows={8}
              value={content}
              onChange={handleTextChange}
              placeholder={contentType === 'application/json' ? 'Enter valid JSON data...' : 'Enter text content...'}
              className={`w-full p-2 border ${
                validationErrors.content ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm`}
            />
            {validationErrors.content && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.content}</p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload File
            </label>
            <div
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${
                isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600 border-dashed'
              } rounded-md`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600 dark:text-gray-400 justify-center">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept={contentType}
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="sr-only"
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {contentType.split('/')[1]?.toUpperCase()} file
                </p>
              </div>
            </div>
            
            {/* File Preview */}
            {uploadedFileName && (
              <div className="mt-3 text-sm text-gray-700 dark:text-gray-300 flex items-center">
                <FileText className="h-4 w-4 mr-1" />
                <span>Selected: {uploadedFileName}</span>
                {file && <span className="ml-1">({Math.round(file.size / 1024)} KB)</span>}
              </div>
            )}
            
            {filePreview && contentType.startsWith('image/') && showPreview && (
              <div className="mt-3">
                <img 
                  src={filePreview} 
                  alt="File preview" 
                  className="max-h-40 rounded border border-gray-300 dark:border-gray-600" 
                />
              </div>
            )}
            
            {validationErrors.file && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.file}</p>
            )}
          </div>
        )}
      </div>
      
      {/* Navigation Buttons */}
      <div className="flex justify-between mt-6">
        <Button
          onClick={previousStep}
          variant="outline"
          className="px-4 py-2"
        >
          Back
        </Button>
        
        <Button
          onClick={handleContinue}
          disabled={!content || Object.keys(validationErrors).length > 0}
          className="px-4 py-2"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default ContentSelectionStep;
