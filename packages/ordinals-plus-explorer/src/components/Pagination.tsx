import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number; // API uses 1-based indexing, ensure consistency
  totalPages: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ currentPage, totalPages, onPageChange }) => {
  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Don't render pagination if there's only one page or less
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-center space-x-4">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
        aria-label="Previous Page"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Prev
      </button>
      
      <span className="text-sm text-gray-700 dark:text-gray-300">
        Page {currentPage} of {totalPages}
      </span>
      
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="px-3 py-1 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
        aria-label="Next Page"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </button>
    </div>
  );
};

export default Pagination; 