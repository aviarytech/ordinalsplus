import React from 'react';

/**
 * Props for ContentInput component.
 */
export interface ContentInputProps {
  contentType: string;
  supportedContentTypes: { mime: string; label: string; isText: boolean }[];
  contentData: string;
  selectedFile: File | null;
  filePreview: string | null;
  isTextContent: boolean;
  flowState: string;
  onContentTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onTextChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * ContentInput handles content type selection, text/file input, and file preview for resource creation.
 */
const ContentInput: React.FC<ContentInputProps> = ({
  contentType,
  supportedContentTypes,
  contentData,
  selectedFile,
  filePreview,
  isTextContent,
  flowState,
  onContentTypeChange,
  onTextChange,
  onFileChange,
}) => {
  return (
    <>
      <div>
        <label htmlFor="contentType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content Type</label>
        <select
          id="contentType"
          value={contentType}
          onChange={onContentTypeChange}
          disabled={flowState !== 'idle' && flowState !== 'awaitingUtxoSelection'}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60"
        >
          {supportedContentTypes.map(ct => (
            <option key={ct.mime} value={ct.mime}>{ct.label} ({ct.mime})</option>
          ))}
        </select>
      </div>
      {isTextContent ? (
        <div>
          <label htmlFor="contentData" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Content</label>
          <textarea
            id="contentData"
            rows={6}
            value={contentData}
            onChange={onTextChange}
            placeholder={contentType === 'application/json' ? 'Enter valid JSON data...' : 'Enter text content...'}
            disabled={flowState !== 'idle' && flowState !== 'awaitingUtxoSelection'}
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm disabled:opacity-60"
          />
        </div>
      ) : (
        <div>
          <label htmlFor="fileUpload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload File</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 dark:border-gray-600 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                <label
                  htmlFor="fileUpload"
                  className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                >
                  <span>Upload a file</span>
                  <input
                    id="fileUpload"
                    name="fileUpload"
                    type="file"
                    accept={contentType}
                    onChange={onFileChange}
                    disabled={flowState !== 'idle' && flowState !== 'awaitingUtxoSelection'}
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
          {selectedFile && (
            <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
              Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
            </div>
          )}
          {filePreview && contentType.startsWith('image/') && (
            <div className="mt-3">
              <img src={filePreview} alt="File preview" className="max-h-40 rounded border border-gray-300 dark:border-gray-600" />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ContentInput; 