import { useState } from 'react';
import { createLinkedResource, getResourceByDid } from '../services/apiService';
import { LinkedResource } from '../types';

interface LinkedResourceCreatorProps {
  onResourceCreated?: (resource: LinkedResource) => void;
  onError?: (error: Error) => void;
}

const LinkedResourceCreator: React.FC<LinkedResourceCreatorProps> = ({ 
  onResourceCreated, 
  onError 
}) => {
  // Form state
  const [resourceType, setResourceType] = useState<string>('Resource');
  const [didReference, setDidReference] = useState<string>('');
  const [resourceName, setResourceName] = useState<string>('');
  const [resourceDescription, setResourceDescription] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [fetchedResource, setFetchedResource] = useState<LinkedResource | null>(null);
  const [didToFetch, setDidToFetch] = useState<string>('');
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Resource type options
  const resourceTypes = [
    'Resource',
    'LinkedResource',
    'Document',
    'Credential',
    'VerifiableCredential',
    'Certificate',
    'Collection',
    'Image',
    'Token',
    'Media'
  ];

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    setError(null);

    try {
      // Prepare resource data
      const resourceData: Record<string, unknown> = {
        type: resourceType,
        name: resourceName,
        description: resourceDescription,
        createdAt: new Date().toISOString()
      };

      // Create the resource
      const createdResource = await createLinkedResource(
        resourceData,
        didReference ? didReference : undefined
      );

      // Call the callback if provided
      if (onResourceCreated) {
        onResourceCreated(createdResource);
      }

      // Reset form
      setResourceName('');
      setResourceDescription('');
      
      // Show success message
      setError(`Resource created successfully with ID: ${createdResource.id}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Error creating resource: ${errorMessage}`);
      
      if (onError && err instanceof Error) {
        onError(err);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleFetchResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsFetching(true);
    setError(null);
    setFetchedResource(null);

    try {
      if (!didToFetch) {
        throw new Error('DID is required to fetch a resource');
      }

      const resource = await getResourceByDid(didToFetch);
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
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Resource Form */}
        <div>
          <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-4">
            Create Linked Resource
          </h3>
          
          <form onSubmit={handleCreateResource} className="space-y-4">
            <div>
              <label htmlFor="resourceType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resource Type
              </label>
              <select
                id="resourceType"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required
              >
                {resourceTypes.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="didReference" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                DID Reference (Optional)
              </label>
              <input
                type="text"
                id="didReference"
                value={didReference}
                onChange={(e) => setDidReference(e.target.value)}
                placeholder="did:btco:..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            
            <div>
              <label htmlFor="resourceName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Resource Name
              </label>
              <input
                type="text"
                id="resourceName"
                value={resourceName}
                onChange={(e) => setResourceName(e.target.value)}
                placeholder="My Resource"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            
            <div>
              <label htmlFor="resourceDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="resourceDescription"
                value={resourceDescription}
                onChange={(e) => setResourceDescription(e.target.value)}
                placeholder="Resource description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                required
              ></textarea>
            </div>
            
            <div>
              <button
                type="submit"
                disabled={isCreating}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
              >
                {isCreating ? 'Creating...' : 'Create Resource'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Fetch Resource Form */}
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