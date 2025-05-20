import React, { useState, useEffect } from 'react';
import { Collection, CollectionCategory } from '../../services/collectionService';
import CollectionCard from './CollectionCard';
import { VerificationStatus } from './CollectionVerificationBadge';
import './CollectionGalleryGrid.css';

interface CollectionGalleryGridProps {
  collections: Collection[];
  loading?: boolean;
  itemsPerPage?: number;
  className?: string;
  onCollectionClick?: (collectionId: string) => void;
}

/**
 * A responsive grid component for displaying collections with filtering and sorting
 */
const CollectionGalleryGrid: React.FC<CollectionGalleryGridProps> = ({
  collections,
  loading = false,
  itemsPerPage = 12,
  className = '',
  onCollectionClick
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([]);
  const [visibleCollections, setVisibleCollections] = useState<Collection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterVerification, setFilterVerification] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('newest');
  
  // Calculate total pages
  const totalPages = Math.ceil(filteredCollections.length / itemsPerPage);
  
  // Filter and sort collections when collections array or filter/sort options change
  useEffect(() => {
    // Apply filters
    let result = [...collections];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(collection => 
        collection.metadata.name.toLowerCase().includes(query) ||
        collection.metadata.description.toLowerCase().includes(query) ||
        (collection.metadata.tags && collection.metadata.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    // Category filter
    if (filterCategory) {
      result = result.filter(collection => 
        collection.metadata.category === filterCategory
      );
    }
    
    // Verification status filter
    if (filterVerification) {
      switch (filterVerification) {
        case VerificationStatus.VERIFIED:
          result = result.filter(collection => collection.metadata.inscriptionId);
          break;
        case VerificationStatus.UNVERIFIED:
          result = result.filter(collection => !collection.metadata.inscriptionId);
          break;
      }
    }
    
    // Apply sorting
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => {
          const dateA = a.metadata.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
          const dateB = b.metadata.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        break;
      case 'oldest':
        result.sort((a, b) => {
          const dateA = a.metadata.createdAt ? new Date(a.metadata.createdAt).getTime() : 0;
          const dateB = b.metadata.createdAt ? new Date(b.metadata.createdAt).getTime() : 0;
          return dateA - dateB;
        });
        break;
      case 'name':
        result.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
        break;
      case 'size':
        result.sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0));
        break;
    }
    
    setFilteredCollections(result);
    setCurrentPage(1); // Reset to first page when filters change
  }, [collections, searchQuery, filterCategory, filterVerification, sortBy]);
  
  // Update visible collections when page changes or filtered collections change
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setVisibleCollections(filteredCollections.slice(startIndex, endIndex));
  }, [currentPage, filteredCollections, itemsPerPage]);
  
  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  // Handle category filter change
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterCategory(e.target.value);
  };
  
  // Handle verification filter change
  const handleVerificationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterVerification(e.target.value);
  };
  
  // Handle sort option change
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value);
  };
  
  // Go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      // Scroll to top of grid
      document.getElementById('collection-gallery-grid')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      // Scroll to top of grid
      document.getElementById('collection-gallery-grid')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Go to specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of grid
      document.getElementById('collection-gallery-grid')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Generate pagination buttons
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    const pageButtons = [];
    const maxVisiblePages = 5;
    
    // Calculate range of visible page buttons
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    // Adjust if we're at the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    // Add first page button
    if (startPage > 1) {
      pageButtons.push(
        <button 
          key="first" 
          onClick={() => goToPage(1)} 
          className="pagination-button"
        >
          1
        </button>
      );
      
      // Add ellipsis if needed
      if (startPage > 2) {
        pageButtons.push(
          <span key="ellipsis1" className="pagination-ellipsis">...</span>
        );
      }
    }
    
    // Add page buttons
    for (let i = startPage; i <= endPage; i++) {
      pageButtons.push(
        <button 
          key={i} 
          onClick={() => goToPage(i)} 
          className={`pagination-button ${i === currentPage ? 'active' : ''}`}
        >
          {i}
        </button>
      );
    }
    
    // Add last page button
    if (endPage < totalPages) {
      // Add ellipsis if needed
      if (endPage < totalPages - 1) {
        pageButtons.push(
          <span key="ellipsis2" className="pagination-ellipsis">...</span>
        );
      }
      
      pageButtons.push(
        <button 
          key="last" 
          onClick={() => goToPage(totalPages)} 
          className="pagination-button"
        >
          {totalPages}
        </button>
      );
    }
    
    return (
      <div className="pagination">
        <button 
          onClick={prevPage} 
          disabled={currentPage === 1}
          className="pagination-button nav"
        >
          &lt; Prev
        </button>
        
        <div className="pagination-pages">
          {pageButtons}
        </div>
        
        <button 
          onClick={nextPage} 
          disabled={currentPage === totalPages}
          className="pagination-button nav"
        >
          Next &gt;
        </button>
      </div>
    );
  };
  
  // Render category options
  const renderCategoryOptions = () => {
    const categories = Object.values(CollectionCategory);
    
    return (
      <>
        <option value="">All Categories</option>
        {categories.map(category => (
          <option key={category} value={category}>
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </option>
        ))}
      </>
    );
  };
  
  // Render verification status options
  const renderVerificationOptions = () => {
    return (
      <>
        <option value="">All Statuses</option>
        <option value={VerificationStatus.VERIFIED}>Verified</option>
        <option value={VerificationStatus.UNVERIFIED}>Not Verified</option>
      </>
    );
  };
  
  // Render sort options
  const renderSortOptions = () => {
    return (
      <>
        <option value="newest">Newest First</option>
        <option value="oldest">Oldest First</option>
        <option value="name">Name (A-Z)</option>
        <option value="size">Size (Largest First)</option>
      </>
    );
  };
  
  return (
    <div className={`collection-gallery-container ${className}`}>
      <div className="collection-gallery-filters">
        <div className="search-filter">
          <input
            type="text"
            placeholder="Search collections..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
        </div>
        
        <div className="filter-controls">
          <div className="filter-group">
            <label htmlFor="category-filter">Category:</label>
            <select
              id="category-filter"
              value={filterCategory}
              onChange={handleCategoryChange}
              className="filter-select"
            >
              {renderCategoryOptions()}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="verification-filter">Verification:</label>
            <select
              id="verification-filter"
              value={filterVerification}
              onChange={handleVerificationChange}
              className="filter-select"
            >
              {renderVerificationOptions()}
            </select>
          </div>
          
          <div className="filter-group">
            <label htmlFor="sort-by">Sort by:</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={handleSortChange}
              className="filter-select"
            >
              {renderSortOptions()}
            </select>
          </div>
        </div>
      </div>
      
      <div className="results-info">
        Showing {visibleCollections.length} of {filteredCollections.length} collections
        {searchQuery && <span> matching "{searchQuery}"</span>}
      </div>
      
      {loading ? (
        <div className="loading-indicator">
          <div className="spinner"></div>
          <p>Loading collections...</p>
        </div>
      ) : visibleCollections.length === 0 ? (
        <div className="no-results">
          <p>No collections found{searchQuery ? ` matching "${searchQuery}"` : ''}.</p>
        </div>
      ) : (
        <div id="collection-gallery-grid" className="collection-gallery-grid">
          {visibleCollections.map(collection => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              onClick={() => onCollectionClick && onCollectionClick(collection.id)}
            />
          ))}
        </div>
      )}
      
      {renderPagination()}
    </div>
  );
};

export default CollectionGalleryGrid;
