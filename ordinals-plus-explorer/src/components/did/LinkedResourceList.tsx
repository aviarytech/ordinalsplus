import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LinkedResource } from 'ordinalsplus';
import { useApi } from '../../context/ApiContext'; // Corrected import path
import './LinkedResourceList.css';

interface LinkedResourceListProps {
  did: string;
}

const LinkedResourceList: React.FC<LinkedResourceListProps> = ({ did }) => {
  const { apiService } = useApi(); // Use the context hook
  const [resources, setResources] = useState<LinkedResource[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResources = async () => {
      if (!apiService) {
        setError("API service is not available.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        console.log(`[LinkedResourceList] Fetching resources for DID: ${did}`);
        // Use fetchResourcesByDid and expect ApiResponse
        const response = await apiService.fetchResourcesByDid(did); 
        console.log(`[LinkedResourceList] Received API response:`, response);

        // Check if response has linkedResources and it's an array
        if (response && Array.isArray(response.linkedResources)) {
          setResources(response.linkedResources);
        } else {
            // Handle cases where linkedResources might be missing or not an array
            console.warn('[LinkedResourceList] Unexpected API response structure:', response);
            setResources([]); // Set to empty array if structure is wrong
        }
      } catch (err) {
        console.error('[LinkedResourceList] Error fetching linked resources:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch linked resources');
        setResources([]); // Clear resources on error
      } finally {
        setIsLoading(false);
      }
    };

    if (did) {
      loadResources();
    } else {
      // If DID is not provided, don't attempt to load
      setIsLoading(false);
      setResources([]);
    }
  }, [did, apiService]); // Re-run effect if did or apiService changes

  if (isLoading) {
    return <div className="loading-indicator">Loading linked resources...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (resources.length === 0) {
    return <div className="no-resources">No linked resources found for this DID.</div>;
  }

  return (
    <div className="linked-resource-list-container">
      <h3 className="linked-resource-list-title">Linked Resources</h3>
      <ul className="linked-resource-list">
        {resources.map((resource) => (
          <li key={resource.id || resource.inscriptionId} className="linked-resource-item">
            <Link to={`/resource/${resource.inscriptionId || resource.id}`} className="linked-resource-link">
              <strong className="resource-type">{resource.type || 'Resource'}</strong>
              <span className="resource-id"> (ID: {resource.inscriptionId || resource.id})</span>
              <div className="resource-details">
                {resource.contentType && <span className="resource-content-type">Type: {resource.contentType}</span>}
                {/* Add more details as needed */}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default LinkedResourceList; 