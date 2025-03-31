import { useState } from 'react';
import ApiService from '../services/apiService';
import { CoreLinkedResource } from '../types';
import ApiServiceProvider from '../services/ApiServiceProvider';

interface LinkedResourceCreatorProps {
  onResourceCreated?: (resource: CoreLinkedResource) => void;
  onError?: (error: Error) => void;
}

const LinkedResourceCreator: React.FC<LinkedResourceCreatorProps> = ({ 
  onResourceCreated, 
  onError 
}) => {
  const [fetchedResource, setFetchedResource] = useState<CoreLinkedResource | null>(null);
  const [didToFetch, setDidToFetch] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Get API service instance
  const apiService = ApiServiceProvider.getInstance().getApiService();

  const handleFetchResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFetching(true);
    setError(null);
    setFetchedResource(null);

    try {
      if (!didToFetch) {
        throw new Error('DID is required to fetch a resource');
      }

      const resource = await apiService.getResourceByDid(didToFetch);
      setFetchedResource(resource);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error fetching resource: ${errorMessage}`);
      
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        DID Linked Resources
      </h2>
      
      <div>
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
          Retrieve Resource by DID
        </h3>
        
        <form onSubmit={handleFetchResource} className="space-y-4 mb-4">
          <div>
            <label htmlFor="didToFetch" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              DID
            </label>
            <input
              type="text"
              id="didToFetch"
              value={didToFetch}
              onChange={(e) => setDidToFetch(e.target.value)}
              placeholder="did:btco:..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              required
            />
          </div>
          
          <div>
            <button
              type="submit"
              disabled={isFetching}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isFetching ? 'Fetching...' : 'Fetch Resource'}
            </button>
          </div>
        </form>
        
        {/* Fetched Resource Display */}
        {fetchedResource && (
          <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-900">
            <h4 className="font-medium text-gray-800 dark:text-white mb-2">
              {typeof fetchedResource.content === 'object' && fetchedResource.content !== null && 'name' in fetchedResource.content
                ? (fetchedResource.content as Record<string, unknown>).name as string
                : 'Resource Details'}
            </h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
              {typeof fetchedResource.content === 'object' && fetchedResource.content !== null && 'description' in fetchedResource.content
                ? (fetchedResource.content as Record<string, unknown>).description as string
                : 'No description available'}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <div><strong>ID:</strong> {fetchedResource.id}</div>
              <div><strong>Type:</strong> {fetchedResource.type}</div>
              {fetchedResource.didReference && (
                <div><strong>DID Reference:</strong> {fetchedResource.didReference}</div>
              )}
              <div><strong>Inscription ID:</strong> {fetchedResource.inscriptionId}</div>
            </div>
          </div>
        )}
      </div>
      
      {/* Error or Success Message */}
      {error && (
        <div className={`mt-4 p-3 rounded ${error.includes('Error') ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100'}`}>
          {error}
        </div>
      )}
    </div>
  );
};

export default LinkedResourceCreator; 