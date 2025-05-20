import React, { useState, useRef, useEffect } from 'react';
import { 
  ResourceType, 
  ResourceMetadata,
  DEFAULT_VALIDATION_RULES,
  validateResource,
  getMimeTypeFromExtension,
  getResourceTypeFromMimeType
} from 'ordinalsplus';
import { useWallet } from '../../context/WalletContext';
import { useApi } from '../../context/ApiContext';
import { useToast } from '../../contexts/ToastContext';
import { AlertCircle, Upload, X, Check, Loader2, Info, Eye, EyeOff } from 'lucide-react';
import { Tooltip } from '../ui';
import ResourcePreview from './ResourcePreview';

interface DIDResourceUploadFormProps {
  didId: string;
  onSuccess?: (resourceId: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Component for uploading and attaching resources to DIDs
 */
const DIDResourceUploadForm: React.FC<DIDResourceUploadFormProps> = ({
  didId,
  onSuccess,
  onError
}) => {
  // File and form state
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [resourceType, setResourceType] = useState<ResourceType>(ResourceType.OTHER);
  const [contentType, setContentType] = useState<string>('');
  const [content, setContent] = useState<string | ArrayBuffer | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Context hooks
  const { connected: walletConnected } = useWallet();
  const { apiService } = useApi();
  const { addToast, addErrorToast } = useToast();

  // Reset form when DID changes
  useEffect(() => {
    resetForm();
  }, [didId]);

  // Process the selected file
  const processFile = (selectedFile: File) => {
    setFile(selectedFile);
    setValidationErrors([]);
    setFieldErrors({});
    
    // Determine content type from file
    const fileType = selectedFile.type;
    if (fileType) {
      setContentType(fileType);
    } else {
      // Fallback to guessing by extension
      const extension = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const mimeType = getMimeTypeFromExtension(extension);
      setContentType(mimeType);
    }
    
    // Determine resource type from content type
    const detectedResourceType = getResourceTypeFromMimeType(fileType || '');
    setResourceType(detectedResourceType);
    
    // Set default label from filename if empty
    if (!label) {
      const fileName = selectedFile.name.split('.')[0];
      setLabel(fileName);
    }
    
    // Read file content
    const reader = new FileReader();
    reader.onload = (e) => {
      setContent(e.target?.result || null);
      // Automatically show preview when file is loaded
      setShowPreview(true);
      
      // Announce file loaded to screen readers
      const announcer = document.getElementById('file-load-announcer');
      if (announcer) {
        announcer.textContent = `File ${selectedFile.name} loaded successfully. Preview is now available.`;
      }
    };
    
    reader.onerror = () => {
      // Handle file reading errors
      setFieldErrors(prev => ({
        ...prev,
        file: `Error reading file: ${reader.error?.message || 'Unknown error'}`
      }));
      
      // Announce error to screen readers
      const announcer = document.getElementById('file-load-announcer');
      if (announcer) {
        announcer.textContent = `Error reading file: ${reader.error?.message || 'Unknown error'}`;
      }
    };
    
    // Show loading state
    const loadingAnnouncer = document.getElementById('file-load-announcer');
    if (loadingAnnouncer) {
      loadingAnnouncer.textContent = 'Loading file, please wait...';
    }
    
    // Read as text or data URL based on file type
    if (fileType.startsWith('text/') || fileType === 'application/json') {
      reader.readAsText(selectedFile);
    } else {
      reader.readAsDataURL(selectedFile);
    }
    
    // Validate file immediately
    validateFileSelection(selectedFile, fileType);
  };
  
  // Handle file selection from input
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    processFile(selectedFile);
  };
  
  // Handle drag events
  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    // Announce to screen readers
    const announcer = document.getElementById('drag-drop-announcer');
    if (announcer) {
      announcer.textContent = 'File detected. Drop to upload.';
    }
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
    
    // Add visual feedback with a pulsing effect
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.add('pulse-animation');
    }
  };
  
  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragging to false if we're leaving the dropzone (not a child element)
    if (e.currentTarget === e.target) {
      setIsDragging(false);
      
      // Remove visual feedback
      if (dropZoneRef.current) {
        dropZoneRef.current.classList.remove('pulse-animation');
      }
      
      // Clear screen reader announcement
      const announcer = document.getElementById('drag-drop-announcer');
      if (announcer) {
        announcer.textContent = '';
      }
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    // Remove visual feedback
    if (dropZoneRef.current) {
      dropZoneRef.current.classList.remove('pulse-animation');
    }
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      processFile(droppedFile);
      
      // Announce to screen readers
      const announcer = document.getElementById('drag-drop-announcer');
      if (announcer) {
        announcer.textContent = `File ${droppedFile.name} selected for upload.`;
      }
    } else {
      // Announce to screen readers if no valid files
      const announcer = document.getElementById('drag-drop-announcer');
      if (announcer) {
        announcer.textContent = 'No valid files detected. Please try again.';
      }
    }
  };
  
  // Validate file selection
  const validateFileSelection = (selectedFile: File, fileType: string) => {
    const errors: Record<string, string> = {};
    const rules = DEFAULT_VALIDATION_RULES[resourceType] || DEFAULT_VALIDATION_RULES[ResourceType.OTHER];
    
    // Check file size
    if (selectedFile.size > rules.maxSize) {
      errors.file = `File size exceeds the maximum allowed (${formatFileSize(rules.maxSize)})`;
    }
    
    // Check file type
    if (rules.allowedContentTypes && rules.allowedContentTypes.length > 0) {
      const isAllowedType = rules.allowedContentTypes.some(allowedType => {
        // Handle wildcards like image/*
        if (allowedType.endsWith('/*')) {
          const typePrefix = allowedType.split('/')[0];
          return fileType.startsWith(`${typePrefix}/`);
        }
        return fileType === allowedType;
      });
      
      if (!isAllowedType) {
        errors.file = `File type '${fileType}' is not supported for this resource type`;
      }
    }
    
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!walletConnected) {
      addErrorToast(new Error('Please connect your wallet to upload resources'));
      return;
    }
    
    if (!file || !content) {
      setValidationErrors(['Please select a file to upload']);
      return;
    }
    
    if (!apiService) {
      addErrorToast(new Error('API service is not available'));
      return;
    }
    
    // Create metadata
    const metadata: ResourceMetadata = {
      type: resourceType,
      name: label,
      description: description,
      size: file.size,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Validate resource
    let contentBuffer: Buffer;
    if (typeof content === 'string') {
      contentBuffer = Buffer.from(content);
    } else if (content instanceof ArrayBuffer) {
      contentBuffer = Buffer.from(new Uint8Array(content));
    } else {
      contentBuffer = Buffer.from([]);
    }
    
    const validation = validateResource(
      contentBuffer,
      contentType,
      metadata,
      resourceType
    );
    
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }
    
    // Start upload process
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      // Prepare resource for upload
      const resourceData = {
        content: content,
        contentType: contentType,
        metadata: metadata,
        parentDid: didId
      };
      
      setUploadProgress(30);
      
      // Call API to create resource
      const result = await apiService.createResource(resourceData);
      
      setUploadProgress(90);
      
      // Handle success
      addToast('Successfully attached resource to DID: ' + didId);
      
      // Reset form
      resetForm();
      
      // Call success callback
      if (onSuccess && result?.resourceId) {
        onSuccess(result.resourceId);
      }
      
      setUploadProgress(100);
    } catch (error) {
      console.error('Error uploading resource:', error);
      
      // Handle error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setValidationErrors([`Upload failed: ${errorMessage}`]);
      
      // Call error callback
      if (onError && error instanceof Error) {
        onError(error);
      }
      
      addErrorToast(new Error('Upload Failed: ' + errorMessage));
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Reset form state
  const resetForm = () => {
    setFile(null);
    setLabel('');
    setDescription('');
    setResourceType(ResourceType.OTHER);
    setContentType('');
    setContent(null);
    setValidationErrors([]);
    setFieldErrors({});
    setUploadProgress(0);
    setIsDragging(false);
    setShowPreview(false);
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get validation rules for current resource type
  const getValidationRules = () => {
    return DEFAULT_VALIDATION_RULES[resourceType] || DEFAULT_VALIDATION_RULES[ResourceType.OTHER];
  };

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Get allowed file types for display
  const getAllowedFileTypes = (): string => {
    const rules = getValidationRules();
    if (!rules.allowedContentTypes || !Array.isArray(rules.allowedContentTypes)) {
      return '';
    }
    return rules.allowedContentTypes.map((type: string) => {
      // Extract main type from MIME type
      const mainType = type.split('/')[1]?.split(';')[0] || type;
      return mainType;
    }).join(', ');
  };

  // Get max file size for display
  const getMaxFileSize = (): string => {
    const rules = getValidationRules();
    return formatFileSize(rules.maxSize);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 md:p-8 resource-upload-form">
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" id="drag-drop-announcer"></div>
      <div className="sr-only" aria-live="polite" id="file-load-announcer"></div>
      <div className="sr-only" aria-live="assertive" id="validation-announcer"></div>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        Add Resource to DID
      </h2>
      
      {!walletConnected ? (
        <div className="text-center p-6 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Please connect your wallet to upload resources
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload Area */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                <Tooltip
                  content={
                    <div>
                      <p>Upload a file to attach to this DID</p>
                      <p className="mt-1">Allowed types: {getAllowedFileTypes()}</p>
                      <p>Max size: {getMaxFileSize()}</p>
                    </div>
                  }
                  position="top"
                  showIcon={true}
                >
                  Resource File
                </Tooltip>
              </label>
              
              {file && (
                <button
                  type="button"
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs flex items-center text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                  aria-label={showPreview ? "Hide preview" : "Show preview"}
                >
                  {showPreview ? (
                    <>
                      <EyeOff className="h-3 w-3 mr-1" /> Hide Preview
                    </>
                  ) : (
                    <>
                      <Eye className="h-3 w-3 mr-1" /> Show Preview
                    </>
                  )}
                </button>
              )}
            </div>
            
            {file && showPreview ? (
              <div className="mb-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <ResourcePreview
                  file={file}
                  content={content}
                  contentType={contentType}
                  resourceType={resourceType}
                />
              </div>
            ) : (
              <div 
                ref={dropZoneRef}
                className={`border-2 border-dashed rounded-lg p-6 text-center ${
                  isDragging ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/20' :
                  file ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20' 
                       : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                } transition-colors duration-200 drop-zone`}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                aria-label="Drop zone for file upload"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  disabled={isUploading}
                  aria-label="File input"
                  accept={getAllowedFileTypes().split(', ').map(type => `.${type}`).join(',')}
                />
                
                {file ? (
                  <div className="flex flex-col items-center">
                    <div className="bg-green-100 dark:bg-green-800/30 rounded-full p-2 mb-2">
                      <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                    </p>
                    {fieldErrors.file && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {fieldErrors.file}
                      </p>
                    )}
                    <button
                      type="button"
                      className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 flex items-center"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setContent(null);
                        setFieldErrors({});
                        setShowPreview(false);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      aria-label="Remove file"
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-full p-2 mb-2">
                      <Upload className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {isDragging ? 'Drop file here' : 'Click to upload or drag and drop'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Allowed types: {getAllowedFileTypes()} • Max size: {getMaxFileSize()}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Resource Type */}
          <div className="form-group">
            <label htmlFor="resource-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Resource Type
            </label>
            <select
              id="resource-type"
              value={resourceType}
              onChange={(e) => {
                const selectedType = e.target.value as ResourceType;
                setResourceType(selectedType);
                
                // If we have a file, validate it against the new resource type
                if (file) {
                  validateFileSelection(file, contentType);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white ${
                fieldErrors.resourceType 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600'
              }`}
              required
              disabled={isUploading}
              aria-invalid={!!fieldErrors.resourceType}
              aria-describedby={fieldErrors.resourceType ? "resource-type-error" : undefined}
            >
              {Object.values(ResourceType).map((type) => (
                <option key={type} value={type}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </option>
              ))}
            </select>
            {fieldErrors.resourceType && (
              <p id="resource-type-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.resourceType}
              </p>
            )}
          </div>
          
          {/* Label */}
          <div className="form-group">
            <label htmlFor="resource-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Label
            </label>
            <input
              id="resource-label"
              type="text"
              value={label}
              onChange={e => {
                setLabel(e.target.value);
                
                // Validate label
                const newFieldErrors = {...fieldErrors};
                if (!e.target.value.trim()) {
                  newFieldErrors.label = 'Label is required';
                } else if (e.target.value.length > 50) {
                  newFieldErrors.label = 'Label must be 50 characters or less';
                } else {
                  delete newFieldErrors.label;
                }
                setFieldErrors(newFieldErrors);
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white ${
                fieldErrors.label 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600'
              }`}
              placeholder="e.g., Profile Picture"
              required
              disabled={isUploading}
              maxLength={50}
              aria-invalid={!!fieldErrors.label}
              aria-describedby={fieldErrors.label ? "label-error" : undefined}
            />
            {fieldErrors.label ? (
              <p id="label-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.label}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                A short, descriptive name for this resource
              </p>
            )}
          </div>
          
          {/* Description */}
          <div className="form-group">
            <label htmlFor="resource-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description
            </label>
            <textarea
              id="resource-description"
              value={description}
              onChange={e => {
                setDescription(e.target.value);
                
                // Validate description
                const newFieldErrors = {...fieldErrors};
                if (e.target.value.length > 200) {
                  newFieldErrors.description = 'Description must be 200 characters or less';
                } else {
                  delete newFieldErrors.description;
                }
                setFieldErrors(newFieldErrors);
              }}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 dark:bg-gray-700 dark:text-white ${
                fieldErrors.description 
                  ? 'border-red-300 focus:border-red-500 focus:ring-red-500 dark:border-red-600' 
                  : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600'
              }`}
              placeholder="Describe this resource..."
              rows={3}
              disabled={isUploading}
              maxLength={200}
              aria-invalid={!!fieldErrors.description}
              aria-describedby={fieldErrors.description ? "description-error" : undefined}
            />
            {fieldErrors.description ? (
              <p id="description-error" className="mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.description}
              </p>
            ) : (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Optional. Provide additional context about this resource.
              </p>
            )}
          </div>
          
          {/* DID Reference */}
          <div className="form-group">
            <label htmlFor="did-reference" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              DID Reference
            </label>
            <div className="flex items-center">
              <input
                id="did-reference"
                type="text"
                value={didId}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                readOnly
                aria-label="DID that this resource will be linked to"
              />
              <Tooltip
                content="This resource will be linked to this DID"
                position="top"
              >
                <Info className="ml-2 h-4 w-4 text-gray-400" aria-hidden="true" />
              </Tooltip>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              This resource will be permanently linked to this DID
            </p>
          </div>
          
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div 
              className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 mt-4 validation-errors" 
              role="alert" 
              aria-live="assertive"
              onFocus={() => {
                // Update screen reader announcement when validation errors get focus
                const announcer = document.getElementById('validation-announcer');
                if (announcer) {
                  announcer.textContent = `${validationErrors.length} validation errors found. Please fix them before submitting.`;
                }
              }}
            >
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 mr-2" aria-hidden="true" />
                <div>
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-300">
                    Please fix the following errors:
                  </h3>
                  <ul className="mt-1 text-sm text-red-700 dark:text-red-200 list-disc list-inside">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* Submit Button */}
          <div className="mt-6">
            <button
              type="submit"
              disabled={isUploading || !file || !label || Object.keys(fieldErrors).length > 0}
              className={`w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isUploading || !file || !label || Object.keys(fieldErrors).length > 0
                  ? 'bg-indigo-400 dark:bg-indigo-600 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200`}
              aria-busy={isUploading}
              aria-disabled={isUploading || !file || !label || Object.keys(fieldErrors).length > 0}
            >
              {isUploading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                  <span>Uploading{uploadProgress > 0 ? ` (${uploadProgress}%)` : '...'}</span>
                </>
              ) : (
                'Add Resource'
              )}
            </button>
          </div>
          
          {/* Upload Progress */}
          {isUploading && uploadProgress > 0 && (
            <div className="mt-4" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div 
                  className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-300" 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="sr-only">Upload progress: {uploadProgress}%</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
};

// Add CSS for drag and drop animations
const styleElement = document.createElement('style');
styleElement.textContent = `
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
  }
  
  .pulse-animation {
    animation: pulse 0.8s infinite;
  }
  
  /* Mobile responsiveness improvements */
  @media (max-width: 640px) {
    .resource-upload-form {
      padding: 1rem;
    }
    
    .drop-zone {
      padding: 1rem;
    }
  }
`;

// Append the style element to the document head if it doesn't exist already
if (typeof document !== 'undefined' && !document.getElementById('resource-upload-styles')) {
  styleElement.id = 'resource-upload-styles';
  document.head.appendChild(styleElement);
}

export default DIDResourceUploadForm;
