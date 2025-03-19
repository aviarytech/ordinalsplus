import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCw
} from 'lucide-react';
import { DidService, DidDocument } from '../services/did-service';
import { formatDid } from '../utils/formatting';
import DidDocumentViewer from './DidDocumentViewer';
import LinkedResourceList from './LinkedResourceList';

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
  apiEndpoint?: string;
}

const DidExplorer: React.FC<DidExplorerProps> = ({ apiEndpoint }) => {
  const [didString, setDidString] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [didDocument, setDidDocument] = useState<DidDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const didService = new DidService(apiEndpoint);
  
  useEffect(() => {
    // Clear results when search query changes
    if (searchQuery !== didString) {
      setDidDocument(null);
      setError(null);
    }
  }, [searchQuery, didString]);
  
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a DID to search');
      return;
    }
    
    const query = searchQuery.trim();
    
    if (!didService.isValidDid(query)) {
      setError(`Invalid DID format: ${query}. DIDs should be in the format did:btco:satNumber`);
      return;
    }
    
    setDidString(query);
    setLoading(true);
    setError(null);
    
    try {
      const document = await didService.resolveDid(query);
      setDidDocument(document);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve DID';
      setError(errorMessage);
      setDidDocument(null);
    } finally {
      setLoading(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  return (
    <div className="w-full max-w-7xl mx-auto p-4">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 rounded-t-lg shadow-md">
        <h1 className="text-2xl font-bold text-white">Ordinals Plus Explorer</h1>
        <p className="text-blue-100">
          Explore Decentralized Identifiers on the Bitcoin blockchain
        </p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-b-lg shadow-md">
        {/* Search Bar */}
        <div className="flex items-center space-x-2 mb-6">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter an Ordinals DID (e.g., did:btco:1234567890)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
          </div>
          <button
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <RotateCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              'Search'
            )}
          </button>
        </div>
        
        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400">
            <p>{error}</p>
          </div>
        )}
        
        {/* DID Document Viewer */}
        {didDocument && (
          <div className="space-y-6">
            <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
                DID: {formatDid(didString)}
              </h2>
            </div>
            
            <DidDocumentViewer document={didDocument} />
            
            {/* Linked Resources */}
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
                Linked Resources
              </h3>
              
              <LinkedResourceList
                didString={didString}
                didService={didService}
              />
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {!loading && !didDocument && !error && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              Enter an Ordinals DID above to explore its details and linked resources
            </p>
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <RotateCw className="h-8 w-8 mx-auto animate-spin text-blue-500" />
            <p className="mt-4 text-gray-500 dark:text-gray-400">
              Loading DID information...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DidExplorer;
