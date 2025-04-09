import React, { useState, useEffect } from 'react';
import { useApiService } from '../hooks/useApiService';
import { LinkedResource } from 'ordinalsplus';
import ResourceCard from './ResourceCard';

interface LinkedResourceListProps {
  didString?: string;
  showAllResources?: boolean;
  contentTypeFilter?: string | null;
  onResourceSelect?: (resource: LinkedResource) => void;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

const LinkedResourceList: React.FC<LinkedResourceListProps> = ({ 
  didString,
  showAllResources = false,
  contentTypeFilter = null,
  onResourceSelect,
  currentPage = 1,
  onPageChange
}) => {
  const [resources, setResources] = useState<LinkedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(20);
  const [selectedResource, setSelectedResource] = useState<LinkedResource | null>(null);
  const apiProvider = useApiService();
  const apiService = apiProvider.getApiService();

  const loadResources = async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (didString) {
        const result = await apiService.getResourceByDid(didString);
        if (!result) {
          setError('Resource not found');
          return;
        }
        setResources([result]);
        setTotalItems(1);
      } else {
        const result = await apiService.fetchAllResources(currentPage, itemsPerPage, contentTypeFilter);
        if (!result) {
          setError('Failed to load resources');
          return;
        }
        setResources(result.linkedResources || []);
        setTotalItems(result.totalItems || 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [didString, currentPage, contentTypeFilter]);

  const handlePageChange = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    }
  };

  const handleResourceClick = (resource: LinkedResource) => {
    setSelectedResource(resource);
    if (onResourceSelect) {
      onResourceSelect(resource);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center py-8">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {resources.map((resource) => (
          <ResourceCard
            key={resource.id}
            resource={resource}
            onClick={() => handleResourceClick(resource)}
            isSelected={selectedResource?.id === resource.id}
          />
        ))}
      </div>
      
      {!didString && (
        <div className="flex justify-center space-x-4 mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700 dark:text-gray-300">
            Page {currentPage} of {Math.ceil(totalItems / itemsPerPage)}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= Math.ceil(totalItems / itemsPerPage)}
            className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default LinkedResourceList; 