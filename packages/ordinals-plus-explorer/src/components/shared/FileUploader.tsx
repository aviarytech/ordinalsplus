import React, { useState, useRef } from 'react';
import { Upload } from 'lucide-react';

export interface FileUploaderProps {
  onFileUpload: (file: File) => void;
  acceptedTypes?: string;
  maxSizeMB?: number;
  className?: string;
}

/**
 * A component for uploading files with drag-and-drop support
 */
const FileUploader: React.FC<FileUploaderProps> = ({
  onFileUpload,
  acceptedTypes = '*/*',
  maxSizeMB = 10,
  className = '',
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Validate file
  const validateFile = (file: File): boolean => {
    const maxSize = maxSizeMB * 1024 * 1024;
    
    // Check file size
    if (file.size > maxSize) {
      setError(`File size exceeds the maximum allowed (${formatFileSize(maxSize)})`);
      return false;
    }
    
    // Check file type if acceptedTypes is specified and not wildcard
    if (acceptedTypes !== '*/*') {
      const acceptedTypesList = acceptedTypes.split(',').map(type => type.trim());
      const fileType = file.type;
      
      // Check if file type matches any of the accepted types
      const isAccepted = acceptedTypesList.some(type => {
        if (type.endsWith('/*')) {
          // Handle wildcard mime types like 'image/*'
          const typePrefix = type.split('/')[0];
          return fileType.startsWith(`${typePrefix}/`);
        }
        return type === fileType;
      });
      
      if (!isAccepted) {
        setError(`File type ${fileType} is not accepted. Please upload a file with one of these types: ${acceptedTypes}`);
        return false;
      }
    }
    
    setError(null);
    return true;
  };

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (validateFile(file)) {
      onFileUpload(file);
    }
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
      const file = e.dataTransfer.files[0];
      if (validateFile(file)) {
        onFileUpload(file);
      }
    }
  };

  // Handle click on the dropzone
  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`file-uploader ${className}`}>
      <div
        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${
          isDragging ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-300 dark:border-gray-600 border-dashed'
        } rounded-md cursor-pointer`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
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
                accept={acceptedTypes}
                onChange={handleFileChange}
                ref={fileInputRef}
                className="sr-only"
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500">
            {acceptedTypes !== '*/*' ? acceptedTypes.replace(/,/g, ', ') : 'Any file type'} (max {maxSizeMB}MB)
          </p>
        </div>
      </div>
      
      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default FileUploader;
