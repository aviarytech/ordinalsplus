import React, { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, Inbox } from 'lucide-react';
import { LinkedResource } from 'ordinalsplus';
import ResourceCard from './ResourceCard';
import { useApi } from '../context/ApiContext';
import { useNetwork } from '../context/NetworkContext';
import { ApiResponse } from '../types/index';
import Pagination from './Pagination.tsx';

interface LinkedResourceListProps {
  did?: string;
  onResourceSelect?: (resource: LinkedResource) => void;
  currentPage?: number;
  contentTypeFilter?: string | null;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
}

const LinkedResourceList: React.FC<LinkedResourceListProps> = ({
  did,
  onResourceSelect = () => {},
  currentPage = 1,
  contentTypeFilter = null,
  itemsPerPage = 20,
  onPageChange = () => {},
}) => {
  const [resources, setResources] = useState<LinkedResource[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState<number>(0);

  const { apiService } = useApi();
  const { network } = useNetwork();

  useEffect(() => {
    if (!apiService || !network?.id) {
      return;
    }

    const fetchDidResources = async (targetDid: string) => {
      setLoading(true);
      setError(null);
      setResources([]);
      setTotalItems(0);
      try {
        const fetchedResources = await apiService.getLinkedResources(network.id, targetDid);
        setResources(fetchedResources || []);
        setTotalItems(fetchedResources.length);
      } catch (err) {
        console.error(`[LinkedResourceList] Error fetching resources for DID ${targetDid}:`, err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to load linked resources';
        setError(errorMsg.includes('404') ? `No linked resources found for this DID.` : errorMsg);
      } finally {
        setLoading(false);
      }
    };

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const response: ApiResponse = await apiService.fetchAllResources(network.id, currentPage, itemsPerPage, contentTypeFilter);
        setResources(response.linkedResources || []);
        setTotalItems(response.totalItems || 0);
      } catch (err) {
        console.error(`[LinkedResourceList] Error fetching all resources:`, err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to load resources';
        setError(errorMsg);
        setResources([]);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    };

    if (did) {
      fetchDidResources(did);
    } else {
      fetchAll();
    }
  }, [did, currentPage, contentTypeFilter, itemsPerPage, apiService, network?.id]);

  const handleCardClick = (resource: LinkedResource) => {
    setSelectedResourceId(resource.id);
    onResourceSelect(resource);
  };

  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (loading && resources.length === 0) {
    return (
      <div className="flex justify-center items-center p-8 min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500 dark:text-gray-400" />
        <span className="ml-2 text-gray-600 dark:text-gray-300">Loading resources...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg min-h-[200px]">
        <AlertTriangle className="h-8 w-8 mb-2" />
        <p className="font-semibold">Error Loading Resources</p>
        <p className="text-sm text-center">{error}</p>
      </div>
    );
  }
  
  if (did && !loading && !error && resources.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-h-[200px]">
              <Inbox className="h-10 w-10 mb-3 text-gray-400 dark:text-gray-500"/>
              <p className="font-semibold">No Linked Resources Found</p>
              <p className="text-sm text-center">This DID does not have any associated resources.</p>
          </div>
      );
  }

  if (!loading && !error && resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg min-h-[200px]">
        <Inbox className="h-10 w-10 mb-3 text-gray-400 dark:text-gray-500"/>
        <p className="font-semibold">No Resources Found</p>
        <p className="text-sm text-center">No resources match the current criteria.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
       {loading && resources.length > 0 && (
         <div className="absolute inset-0 bg-gray-100/50 dark:bg-gray-800/50 flex justify-center items-center z-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500 dark:text-gray-400" />
         </div>
       )}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 ${loading ? 'opacity-50' : ''}`}>
        {resources.map((resource) => (
          <ResourceCard 
              key={resource.id}
              resource={resource}
              onClick={() => handleCardClick(resource)}
              isSelected={selectedResourceId === resource.id}
           />
        ))}
      </div>
      {!did && totalPages > 1 && (
          <div className="flex justify-center pt-4">
              <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={onPageChange} 
              />
          </div>
      )}
    </div>
  );
};

export default LinkedResourceList; 