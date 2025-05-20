import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collectionService, Collection, CollectionCategory } from '../services/collectionService';

/**
 * Page component for displaying a list of collections
 */
const CollectionsListPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalCollections, setTotalCollections] = useState(0);
  const [limit] = useState(12);
  
  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...collectionService.getCollectionCategories()
  ];
  
  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // In a real implementation, this would use the category filter
        // We'll pass the category filter to the API in a real implementation
        // const category = selectedCategory !== 'all' ? selectedCategory as CollectionCategory : undefined;
        
        const response = await collectionService.getCollectionsByCurator('', page, limit);
        setCollections(response.collections);
        setTotalCollections(response.total);
      } catch (err: any) {
        console.error('Error fetching collections:', err);
        setError(err.message || 'Failed to load collections');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCollections();
  }, [page, limit, selectedCategory]);
  
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
    setPage(1); // Reset to first page when changing category
  };
  
  const totalPages = Math.ceil(totalCollections / limit);
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Collections
        </h1>
        <Link
          to="/collections/create"
          className="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50"
        >
          Create Collection
        </Link>
      </div>
      
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="mb-4 sm:mb-0">
            <label htmlFor="category-filter" className="sr-only">
              Filter by Category
            </label>
            <select
              id="category-filter"
              className="w-full sm:w-auto p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      ) : collections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No collections found.
          </p>
          <Link
            to="/collections/create"
            className="text-orange-500 hover:text-orange-700"
          >
            Create your first collection
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {collections.map((collection) => (
              <Link
                key={collection.id}
                to={`/collections/${collection.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300"
              >
                <div className="h-48 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  {collection.metadata.image ? (
                    <img
                      src={collection.metadata.image}
                      alt={collection.metadata.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-gray-400 dark:text-gray-500 text-lg">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                    {collection.metadata.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    {collection.items.length} items
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    {collection.metadata.description}
                  </p>
                  
                  <div className="mt-3 flex items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-full px-2 py-1">
                      {collection.metadata.category}
                    </span>
                    {collection.credentialId && (
                      <span className="ml-2 text-xs text-green-500 bg-green-100 dark:bg-green-900 dark:text-green-300 rounded-full px-2 py-1">
                        Verified
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="flex items-center">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-l-md bg-white dark:bg-gray-800 dark:border-gray-600 disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="px-4 py-1 border-t border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                  Page {page} of {totalPages}
                </div>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-r-md bg-white dark:bg-gray-800 dark:border-gray-600 disabled:opacity-50"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default CollectionsListPage;
