import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collectionService, Collection } from '../services/collectionService';
import CollectionGalleryGrid from '../components/collections/CollectionGalleryGrid';
import './CollectionsGalleryPage.css';

/**
 * Page component for displaying a gallery of collections
 */
const CollectionsGalleryPage: React.FC = () => {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const itemsPerPage = 12;
  
  // Fetch collections when component mounts
  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch all collections from the API
        const response = await collectionService.getCollectionsByCurator('', 1, 100);
        setCollections(response.collections);
      } catch (err: any) {
        console.error('Error fetching collections:', err);
        setError(err.message || 'Failed to load collections');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCollections();
  }, []);
  
  // Handle collection click
  const handleCollectionClick = (collectionId: string) => {
    navigate(`/collections/${collectionId}`);
  };
  
  return (
    <div className="collections-gallery-page">
      <div className="page-header">
        <h1>Collections Gallery</h1>
        <p>Explore curated collections of inscriptions</p>
      </div>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      )}
      
      <CollectionGalleryGrid 
        collections={collections}
        loading={loading}
        itemsPerPage={itemsPerPage}
        onCollectionClick={handleCollectionClick}
        className="collections-gallery"
      />
    </div>
  );
};

export default CollectionsGalleryPage;
