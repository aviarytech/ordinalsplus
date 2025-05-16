import React from 'react';
import { Link } from 'react-router-dom';
import { Collection } from '../../services/collectionService';
import CollectionVerificationBadge, { VerificationStatus } from './CollectionVerificationBadge';
import './CollectionCard.css';

interface CollectionCardProps {
  collection: Collection;
  className?: string;
  onClick?: () => void;
}

/**
 * A card component that displays a collection preview
 */
const CollectionCard: React.FC<CollectionCardProps> = ({ collection, className = '', onClick }) => {
  // Determine verification status based on collection data
  const getVerificationStatus = (): VerificationStatus => {
    if (collection.metadata.inscriptionId) {
      return VerificationStatus.VERIFIED;
    }
    
    // Check if there's a credential
    if (collection.credential) {
      return VerificationStatus.VERIFIED;
    }
    
    return VerificationStatus.UNVERIFIED;
  };

  // Format the date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return 'Unknown date';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Get the number of items in the collection
  const itemCount = collection.items.length;

  // Get a preview image for the collection
  const getCollectionImage = (): string => {
    // If the collection has a custom image, use that
    if (collection.metadata.image) {
      return collection.metadata.image;
    }
    
    // Otherwise, try to use the first item's image if available
    if (itemCount > 0 && collection.items[0].thumbnailUrl) {
      return collection.items[0].thumbnailUrl;
    }
    
    // Fallback to a placeholder
    return 'https://placehold.co/300x300?text=Collection';
  };

  // Card content that's the same regardless of wrapper
  const cardContent = (
    <>
      <div className="collection-card-image">
        <img src={getCollectionImage()} alt={collection.metadata.name} />
        <div className="collection-item-count">
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </div>
      </div>
      
      <div className="collection-card-content">
        <h3 className="collection-title">{collection.metadata.name}</h3>
        
        <div className="collection-meta">
          <div className="collection-curator">
            <span className="meta-label">Curator:</span>
            <span className="curator-did" title={collection.curatorDid}>
              {collection.curatorDid.substring(0, 10)}...
            </span>
          </div>
          
          <div className="collection-date">
            <span className="meta-label">Created:</span>
            <span className="date">{formatDate(collection.metadata.createdAt)}</span>
          </div>
        </div>
        
        <p className="collection-description">
          {collection.metadata.description.length > 120
            ? `${collection.metadata.description.substring(0, 120)}...`
            : collection.metadata.description}
        </p>
        
        <div className="collection-footer">
          <CollectionVerificationBadge 
            status={getVerificationStatus()} 
            inscriptionId={collection.metadata.inscriptionId}
          />
          
          <div className="collection-category">
            {collection.metadata.category}
          </div>
        </div>
      </div>
    </>
  );

  // If onClick is provided, use a clickable div instead of a Link
  if (onClick) {
    return (
      <div 
        className={`collection-card ${className}`} 
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
      >
        {cardContent}
      </div>
    );
  }

  // Otherwise, use a Link
  return (
    <Link to={`/collections/${collection.id}`} className={`collection-card ${className}`}>
      {cardContent}
    </Link>
  );
};

export default CollectionCard;
