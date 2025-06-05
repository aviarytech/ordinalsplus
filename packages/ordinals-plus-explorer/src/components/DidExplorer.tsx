import React, { useState } from 'react';
import {
  Search,
  RotateCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import DidDocumentViewer from './DidDocumentViewer';
import LinkedResourceList from './LinkedResourceList';
import { DidDocument, LinkedResource } from 'ordinalsplus';
import { useNetwork } from '../context/NetworkContext';
import { useApi } from '../context/ApiContext';

// Simple Label component with proper types (unused for now but kept for reference)
/* interface LabelProps {
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}

const Label = ({ htmlFor, children, className = '' }: LabelProps) => (
  <label htmlFor={htmlFor} className={`block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 ${className}`}>
    {children}
  </label>
); */

// Simple Pagination component with proper types (unused for now but kept for reference)
/* interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

const Pagination = ({ currentPage, totalPages, onPageChange, siblingCount = 1 }: PaginationProps) => {
  const pages = [];
  
  // Add previous button
  pages.push(
    <button
      key="prev"
      onClick={() => currentPage > 0 && onPageChange(currentPage - 1)}
      disabled={currentPage === 0}
      className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 flex items-center justify-center"
    >
      <ChevronLeft className="h-4 w-4" />
    </button>
  );
  
  // Calculate page numbers to show
  const pageNumbers = [];
  
  // Always show first page
  pageNumbers.push(0);
  
  // Calculate start and end
  const startPage = Math.max(1, currentPage - siblingCount);
  const endPage = Math.min(totalPages - 2, currentPage + siblingCount);
  
  // Add ellipsis after first page if needed
  if (startPage > 1) {
    pageNumbers.push(-1); // -1 represents ellipsis
  }
  
  // Add middle pages
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }
  
  // Add ellipsis before last page if needed
  if (endPage < totalPages - 2) {
    pageNumbers.push(-2); // -2 represents ellipsis
  }
  
  // Always show last page if there is more than one page
  if (totalPages > 1) {
    pageNumbers.push(totalPages - 1);
  }
  
  // Add page buttons
  pageNumbers.forEach(pageNum => {
    if (pageNum < 0) {
      // Ellipsis
      pages.push(
        <span key={`ellipsis${pageNum}`} className="px-3 py-1">
          &hellip;
        </span>
      );
    } else {
      pages.push(
        <button
          key={pageNum}
          onClick={() => onPageChange(pageNum)}
          disabled={currentPage === pageNum}
          className={`px-3 py-1 rounded border ${
            currentPage === pageNum 
              ? 'bg-blue-500 text-white border-blue-500' 
              : 'border-gray-300 dark:border-gray-600'
          }`}
        >
          {pageNum + 1}
        </button>
      );
    }
  });
  
  // Add next button
  pages.push(
    <button
      key="next"
      onClick={() => currentPage < totalPages - 1 && onPageChange(currentPage + 1)}
      disabled={currentPage === totalPages - 1}
      className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 flex items-center justify-center"
    >
      <ChevronRight className="h-4 w-4" />
    </button>
  );
  
  return (
    <div className="flex space-x-2">
      {pages}
    </div>
  );
}; */

interface DidExplorerProps {
  onResourceSelect?: (resource: LinkedResource) => void;
}

interface ResolutionMetadata {
  inscriptionId?: string;
  satNumber?: string;
  contentType?: string;
  deactivated?: boolean;
  message?: string;
  network?: string;
  foundContent?: string;
}

interface ApiResolutionResult {
  status: 'success' | 'error';
  message?: string;
  data?: {
    didDocument?: DidDocument;
    inscriptions?: Array<{
      inscriptionId: string;
      content: string;
      metadata: any;
      contentUrl?: string;
      isValidDid?: boolean;
      didDocument?: DidDocument | null;
      error?: string;
    }>;
    resolutionMetadata?: ResolutionMetadata & {
      totalInscriptions?: number;
    };
    didDocumentMetadata?: any;
    error?: string;
    inscriptionId?: string;
    satNumber?: string;
    network?: string;
    foundContent?: string;
  };
}

const DidExplorer: React.FC<DidExplorerProps> = ({ onResourceSelect }: DidExplorerProps) => {
  const [searchQuery, setSearchQuery] = useState('did:btco:sig:YOUR_SATOSHI_NUMBER_HERE');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didDocument, setDidDocument] = useState<DidDocument | null>(null);
  const [didString, setDidString] = useState<string>('');
  const [resolutionResult, setResolutionResult] = useState<ApiResolutionResult | null>(null);
  const [allInscriptions, setAllInscriptions] = useState<Array<{
    inscriptionId: string;
    content: string;
    metadata: any;
    contentUrl?: string;
    isValidDid?: boolean;
    didDocument?: DidDocument | null;
    error?: string;
  }> | null>(null);
  const [_, setCurrentPage] = useState(0);
  const [__, setTotalPages] = useState(0);
  const { network } = useNetwork();
  const { apiService } = useApi();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);
    setDidDocument(null);
    setResolutionResult(null);
    setAllInscriptions(null);

    try {
      if (!apiService) {
        throw new Error('API service not available');
      }

      // Use the backend API endpoint for DID resolution
      try {
        const result = await apiService.resolveDid(searchQuery.trim());
        
        // Create a result structure that matches our interface
        const apiResult: ApiResolutionResult = {
          status: 'success',
          data: {
            didDocument: result.didDocument,
            inscriptions: result.inscriptions,
            resolutionMetadata: {
              contentType: result.resolutionMetadata?.contentType || 'application/did+ld+json',
              inscriptionId: result.resolutionMetadata?.inscriptionId,
              satNumber: result.resolutionMetadata?.satNumber,
              network: result.resolutionMetadata?.network,
              deactivated: result.resolutionMetadata?.deactivated,
              totalInscriptions: result.resolutionMetadata?.totalInscriptions
            },
            didDocumentMetadata: result.didDocumentMetadata
          }
        };
        
        setResolutionResult(apiResult);
        setAllInscriptions(result.inscriptions || null);

        if (result.didDocument) {
          setDidDocument(result.didDocument);
          setDidString(searchQuery.trim());
          setTotalPages(1);
          setCurrentPage(0);
        } else {
          // Check if we have inscriptions - if so, just show them without treating as error
          if (result.inscriptions && result.inscriptions.length > 0) {
            const validDidInscriptions = result.inscriptions.filter(i => i.isValidDid);
            if (validDidInscriptions.length > 0) {
              setError(`Found ${result.inscriptions.length} inscription(s) on this satoshi, ${validDidInscriptions.length} contain(s) DID references, but no valid DID document could be extracted. Check the metadata or inscription content.`);
            } else {
              // Don't set error for this case - just show the inscriptions
              console.log(`Found ${result.inscriptions.length} inscription(s) on this satoshi, but none contain valid BTCO DID references.`);
            }
          } else {
            setError('No inscriptions found on this satoshi');
          }
        }
      } catch (apiError) {
        // Handle specific API errors
        const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
        
        if (errorMessage.includes('metadataNotAvailable')) {
          setError(
            'BTCO DID found but full resolution is not yet available. ' +
            'The inscription exists and contains a valid DID reference, but CBOR metadata parsing is needed to extract the DID document.'
          );
        } else if (errorMessage.includes('deactivated')) {
          setError('This DID has been deactivated (🔥)');
        } else if (errorMessage.includes('404') || errorMessage.includes('Not Found') || errorMessage.includes('notFound')) {
          if (searchQuery.includes('sig:')) {
            setError(
              `DID not found: ${searchQuery.trim()}\n\n` +
              'For signet network:\n' +
              '• Make sure your local ord node is running on http://127.0.0.1:80\n' +
              '• Verify the satoshi number has inscriptions\n' +
              '• Check that the inscription contains a valid BTCO DID document'
            );
          } else {
            setError(`DID not found: ${searchQuery.trim()}`);
          }
        } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
          setError(
            'Server error occurred while resolving DID. This might be due to the BTCO DID resolution implementation being incomplete. ' +
            'Please try again later or contact support if the issue persists.'
          );
        } else if (errorMessage.includes('Failed to connect') || errorMessage.includes('ECONNREFUSED')) {
          if (searchQuery.includes('sig:')) {
            setError(
              'Connection failed to local ord node. For signet DIDs:\n\n' +
              '• Ensure your local ord signet node is running\n' +
              '• Check that it\'s accessible at http://127.0.0.1:80\n' +
              '• Verify the node is fully synced'
            );
          } else {
            setError(`Connection failed: ${errorMessage}`);
          }
        } else {
          setError(`Resolution failed: ${errorMessage}`);
        }
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve DID';
      
      // Provide specific guidance for common issues
      if (errorMessage.includes('Network request failed') || errorMessage.includes('fetch')) {
        setError(
          'Network Error: Unable to connect to the API. ' +
          'Please check your internet connection and try again.'
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const renderResolutionMetadata = () => {
    if (!resolutionResult || !resolutionResult.data?.resolutionMetadata) return null;

    const metadata = resolutionResult.data.resolutionMetadata;

    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Resolution Details
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          {metadata.inscriptionId && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Latest Valid Inscription:</span>
              <div className="flex items-center gap-2">
                <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                  {metadata.inscriptionId}
                </code>
                <a
                  href={`https://ordiscan.com/inscription/${metadata.inscriptionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
          
          {metadata.satNumber && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Satoshi Number:</span>
              <div className="flex items-center gap-2">
                <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono">
                  {metadata.satNumber}
                </code>
                <a
                  href={`https://ordiscan.com/sat/${metadata.satNumber}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}
          
          {metadata.totalInscriptions && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Total Inscriptions:</span>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono ml-2">
                {metadata.totalInscriptions}
              </code>
            </div>
          )}
          
          {metadata.contentType && (
            <div>
              <span className="font-medium text-gray-600 dark:text-gray-400">Content Type:</span>
              <code className="bg-white dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono ml-2">
                {metadata.contentType}
              </code>
            </div>
          )}
          
          {metadata.deactivated && (
            <div className="col-span-2">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <XCircle className="w-4 h-4" />
                <span className="font-medium">DID Status: Deactivated</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAllInscriptions = () => {
    if (!allInscriptions || allInscriptions.length === 0) return null;

    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg space-y-3">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Search className="w-5 h-5 text-blue-500" />
          All Inscriptions on Satoshi ({allInscriptions.length})
        </h3>
        
        <div className="space-y-3">
          {allInscriptions.map((inscription, index) => (
            <div key={inscription.inscriptionId} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-white dark:bg-gray-700">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    #{index + 1}
                  </span>
                  {inscription.isValidDid && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                      Valid DID
                    </span>
                  )}
                  {inscription.didDocument && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                      Has DID Document
                    </span>
                  )}
                  {inscription.error && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100">
                      Error
                    </span>
                  )}
                </div>
                <a
                  href={`https://ordiscan.com/inscription/${inscription.inscriptionId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
              
              <div className="grid grid-cols-1 gap-2 text-sm">
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Inscription ID:</span>
                  <code className="bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded text-xs font-mono ml-2">
                    {inscription.inscriptionId}
                  </code>
                </div>
                
                {inscription.contentUrl && (
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Content URL:</span>
                    <a 
                      href={inscription.contentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 text-xs ml-2 break-all"
                    >
                      {inscription.contentUrl}
                    </a>
                  </div>
                )}
                
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">Content:</span>
                  <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
                    {inscription.content || 'No content available'}
                  </div>
                </div>
                
                {inscription.metadata && (
                  <div>
                    <span className="font-medium text-gray-600 dark:text-gray-400">Metadata:</span>
                    <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-600 rounded text-xs font-mono break-all max-h-20 overflow-y-auto">
                      {JSON.stringify(inscription.metadata, null, 2)}
                    </div>
                  </div>
                )}
                
                {inscription.error && (
                  <div>
                    <span className="font-medium text-red-600 dark:text-red-400">Error:</span>
                    <div className="text-red-600 dark:text-red-400 text-xs ml-2">
                      {inscription.error}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-2">
          BTCO DID Resolution
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Enter a BTCO DID to resolve it according to the BTCO DID Method Specification
        </p>
      </div>

      {/* Search Input */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter BTCO DID (e.g., did:btco:1234567890)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:ring-orange-500 focus:border-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-lg"
          />
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Supported formats: did:btco:&lt;satoshi&gt;, did:btco:test:&lt;satoshi&gt;, did:btco:sig:&lt;satoshi&gt;
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading || !searchQuery.trim()}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading ? (
            <>
              <RotateCw className="w-5 h-5 animate-spin" />
              Resolving...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Resolve
            </>
          )}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg dark:bg-red-900 dark:border-red-700 dark:text-red-100 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium">Resolution Failed</h4>
            <p className="mt-1 whitespace-pre-line">{error}</p>
          </div>
        </div>
      )}

      {/* Resolution Metadata */}
      {resolutionResult && !error && renderResolutionMetadata()}

      {/* All Inscriptions */}
      {renderAllInscriptions()}

      {/* DID Document and Resources */}
      {didDocument && (
        <div className="space-y-6">
          <DidDocumentViewer document={didDocument} />
          <LinkedResourceList
            did={didString}
            onResourceSelect={onResourceSelect || (() => {})}
          />
        </div>
      )}
    </div>
  );
};

export default DidExplorer;
