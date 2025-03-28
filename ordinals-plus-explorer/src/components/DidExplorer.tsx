import React, { useState } from 'react';
import {
  Search,
  RotateCw
} from 'lucide-react';
import { DidService, DidDocument } from '../services/did-service';
import DidDocumentViewer from './DidDocumentViewer';
import LinkedResourceList from './LinkedResourceList';
import { LinkedResource } from 'ordinalsplus';

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

const DidExplorer: React.FC<DidExplorerProps> = ({ onResourceSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didDocument, setDidDocument] = useState<DidDocument | null>(null);
  const [didString, setDidString] = useState<string>('');
  const [_, setCurrentPage] = useState(0);
  const [__, setTotalPages] = useState(0);

  const didService = new DidService();

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const document = await didService.resolveDid(searchQuery.trim());
      setDidDocument(document);
      setDidString(searchQuery.trim());
      setTotalPages(1); // Since we're not paginating the DID document
      setCurrentPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve DID');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter DID (e.g., did:btco:1234567890/0)"
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isLoading ? (
            <RotateCw className="w-5 h-5 animate-spin" />
          ) : (
            <Search className="w-5 h-5" />
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-md dark:bg-red-900 dark:text-red-100">
          {error}
        </div>
      )}

      {didDocument && (
        <div className="space-y-6">
          <DidDocumentViewer document={didDocument} />
          <LinkedResourceList
            didString={didString}
            didService={didService}
            showAllResources={false}
            onResourceSelect={onResourceSelect}
          />
        </div>
      )}
    </div>
  );
};

export default DidExplorer;
