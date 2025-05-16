import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CollectionItem } from '../../services/collectionService';
import './CollectionItemsGrid.css';

interface CollectionItemsGridProps {
  items: CollectionItem[];
  className?: string;
  itemsPerPage?: number;
  loading?: boolean;
}

/**
 * A grid component that displays collection items with lazy loading and pagination
 */
const CollectionItemsGrid: React.FC<CollectionItemsGridProps> = ({
  items,
  className = '',
  itemsPerPage = 12,
  loading = false
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleItems, setVisibleItems] = useState<CollectionItem[]>([]);
  
  // Calculate total pages
  const totalPages = Math.ceil(items.length / itemsPerPage);
  
  // Update visible items when page changes or items change
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setVisibleItems(items.slice(startIndex, endIndex));
  }, [currentPage, items, itemsPerPage]);
  
  // Go to next page
  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      // Scroll to top of grid
      document.getElementById('collection-items-grid')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Go to previous page
  const prevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      // Scroll to top of grid
      document.getElementById('collection-items-grid')?.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  // Go to specific page
  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Scroll to top of grid
      document.getElementById('collection-items-grid')?.scrollIntoView({ behavior: 'smooth' });
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
          className="pagination-button prev"
        >
          &laquo; Prev
        </button>
        
        <div className="pagination-pages">
          {pageButtons}
        </div>
        
        <button 
          onClick={nextPage} 
          disabled={currentPage === totalPages}
          className="pagination-button next"
        >
          Next &raquo;
        </button>
      </div>
    );
  };
  
  // Render loading skeleton
  const renderSkeleton = () => {
    return Array(itemsPerPage).fill(0).map((_, index) => (
      <div key={`skeleton-${index}`} className="collection-item-card skeleton">
        <div className="skeleton-image"></div>
        <div className="skeleton-content">
          <div className="skeleton-title"></div>
          <div className="skeleton-meta"></div>
        </div>
      </div>
    ));
  };
  
  return (
    <div className={`collection-items-container ${className}`}>
      <div id="collection-items-grid" className="collection-items-grid">
        {loading ? (
          renderSkeleton()
        ) : (
          visibleItems.map((item) => (
            <Link 
              key={item.did} 
              to={`/inscriptions/${item.inscriptionId || item.did}`}
              className="collection-item-card"
            >
              <div className="item-image">
                <img 
                  src={item.thumbnailUrl || 'https://placehold.co/200x200?text=No+Image'} 
                  alt={item.title || 'Collection item'} 
                  loading="lazy"
                />
              </div>
              <div className="item-content">
                <h4 className="item-title">{item.title || 'Untitled Item'}</h4>
                <div className="item-meta">
                  {item.inscriptionId && (
                    <span className="item-inscription-id" title={item.inscriptionId}>
                      #{item.inscriptionId.substring(0, 8)}...
                    </span>
                  )}
                  {item.addedAt && (
                    <span className="item-date">
                      Added {new Date(item.addedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {item.notes && <p className="item-notes">{item.notes}</p>}
              </div>
            </Link>
          ))
        )}
      </div>
      
      {!loading && items.length === 0 && (
        <div className="no-items-message">
          No items in this collection yet.
        </div>
      )}
      
      {!loading && items.length > 0 && renderPagination()}
    </div>
  );
};

export default CollectionItemsGrid;
