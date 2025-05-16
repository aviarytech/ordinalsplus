import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collectionService, Collection } from '../services/collectionService';
import IssueCollectionCredentialButton from '../components/collection/IssueCollectionCredentialButton';
import CollectionVerificationBadge, { VerificationStatus } from '../components/collections/CollectionVerificationBadge';
import CollectionVerificationDetails from '../components/collections/CollectionVerificationDetails';
import CollectionItemsGrid from '../components/collections/CollectionItemsGrid';
import CollectionSharePanel from '../components/collections/CollectionSharePanel';
import './CollectionDetailPage.css';

/**
 * Page component for displaying collection details
 */
const CollectionDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inscribingCollection, setInscribingCollection] = useState(false);
  const [inscriptionStatus, setInscriptionStatus] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchCollection = async () => {
      if (!id) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const data = await collectionService.getCollection(id);
        setCollection(data);
      } catch (err: any) {
        console.error('Error fetching collection:', err);
        setError(err.message || 'Failed to load collection');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCollection();
  }, [id]);
  
  const handleCredentialIssued = (credentialId: string) => {
    // Update the collection with the new credential ID
    if (collection) {
      setCollection({
        ...collection,
        credentialId
      });
    }
  };

  const handleInscribeCollection = async () => {
    if (!collection || !id) return;
    
    setInscribingCollection(true);
    setInscriptionStatus('Starting inscription process...');
    
    try {
      // Use the curator DID as the requester DID for now
      const inscriptionId = await collectionService.inscribeCollection(
        id,
        collection.curatorDid,
        { feeRate: 5 } // Use a reasonable fee rate
      );
      
      // Update the collection with the new inscription ID
      setCollection({
        ...collection,
        metadata: {
          ...collection.metadata,
          inscriptionId
        }
      });
      
      setInscriptionStatus('Collection successfully inscribed on-chain!');
    } catch (err: any) {
      console.error('Error inscribing collection:', err);
      setInscriptionStatus(`Inscription failed: ${err.message || 'Unknown error'}`);
    } finally {
      setInscribingCollection(false);
    }
  };
  
  // Get verification status based on collection data
  const getVerificationStatus = (): VerificationStatus => {
    if (!collection) return VerificationStatus.UNVERIFIED;
    
    if (collection.metadata.inscriptionId) {
      return VerificationStatus.VERIFIED;
    }
    
    if (inscribingCollection) {
      return VerificationStatus.PENDING;
    }
    
    return VerificationStatus.UNVERIFIED;
  };
  
  if (loading) {
    return (
      <div className="collection-detail-page loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading collection...</p>
        </div>
      </div>
    );
  }
  
  if (error || !collection) {
    return (
      <div className="collection-detail-page error">
        <div className="error-message">
          <h2>Error Loading Collection</h2>
          <p>{error || 'Collection not found'}</p>
          <Link to="/collections" className="back-link">Back to Collections</Link>
        </div>
      </div>
    );
  }
  
  // Format date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  
  return (
    <div className="collection-detail-page">
      <div className="page-header">
        <Link to="/collections" className="back-link">
          &larr; Back to Collections
        </Link>
      </div>
      
      <div className="collection-detail-container">
        <div className="collection-header">
          <div className="collection-header-info">
            <h1 className="collection-title">{collection.metadata.name}</h1>
            <div className="collection-metadata">
              <p className="collection-description">{collection.metadata.description}</p>
              <div className="collection-details">
                <div className="detail-item">
                  <span className="detail-label">Curator:</span>
                  <span className="detail-value">{collection.curatorDid}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Category:</span>
                  <span className="detail-value">{collection.metadata.category}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Items:</span>
                  <span className="detail-value">{collection.items.length}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Created:</span>
                  <span className="detail-value">
                    {collection.metadata.createdAt ? formatDate(collection.metadata.createdAt) : 'Unknown'}
                  </span>
                </div>
              </div>
              
              <div className="collection-verification">
                <CollectionVerificationBadge 
                  status={getVerificationStatus()} 
                  inscriptionId={collection.metadata.inscriptionId}
                  showDetails
                />
                
                <CollectionVerificationDetails
                  status={getVerificationStatus()}
                  inscriptionId={collection.metadata.inscriptionId}
                  collectionId={collection.id}
                  verifiedAt={collection.metadata.updatedAt}
                  onChainData={collection.metadata.inscriptionId ? {
                    inscriptionNumber: parseInt(collection.metadata.inscriptionId.split('i')[1]),
                    timestamp: collection.metadata.updatedAt,
                    block: 0, // This would come from the API
                    transactionId: '' // This would come from the API
                  } : undefined}
                />
              </div>
              
              <div className="collection-actions">
                {!collection.metadata.inscriptionId && !inscribingCollection && (
                  <button 
                    className="inscribe-button"
                    onClick={handleInscribeCollection}
                    disabled={inscribingCollection}
                  >
                    Inscribe On-chain
                  </button>
                )}
                
                {!collection.credentialId && (
                  <IssueCollectionCredentialButton 
                    collectionId={collection.id}
                    issuerDid={collection.curatorDid}
                    onCredentialIssued={handleCredentialIssued}
                  />
                )}
                
                {inscriptionStatus && (
                  <div className="inscription-status">
                    <p>{inscriptionStatus}</p>
                  </div>
                )}
              </div>
              
              <CollectionSharePanel collection={collection} />
            </div>
          </div>
        </div>
        
        <div className="collection-content">
          <h2 className="section-title">Collection Items</h2>
          <CollectionItemsGrid 
            items={collection.items} 
            loading={false}
          />
        </div>
      </div>
    </div>
  );
};

export default CollectionDetailPage;
