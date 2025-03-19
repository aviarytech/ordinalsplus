import LinkedResourceCreator from '../components/LinkedResourceCreator';
import LinkedResourceList from '../components/LinkedResourceList';
import { useState } from 'react';
import { Filter, ListFilter, ImageIcon } from 'lucide-react';

const LinkedResourcesPage = () => {
  const [viewMode, setViewMode] = useState<'create' | 'browse'>('browse');
  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(null);

  return (
    <div className="max-w-7xl mx-auto p-5">
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Ordinals Plus Resources</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => setViewMode('create')}
              className={`px-4 py-2 rounded-full flex items-center ${
                viewMode === 'create' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Create Resource
            </button>
            <button 
              onClick={() => setViewMode('browse')}
              className={`px-4 py-2 rounded-full flex items-center ${
                viewMode === 'browse' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <ListFilter className="h-4 w-4 mr-2" />
              Browse Resources
            </button>
          </div>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
          {viewMode === 'create' 
            ? 'Create new resources linked to Bitcoin Ordinals' 
            : 'Browse all resources in the Bitcoin Ordinals network'}
        </p>
      </header>
      
      {viewMode === 'browse' && (
        <div className="flex mb-6 space-x-2">
          <button
            onClick={() => setContentTypeFilter(null)}
            className={`px-4 py-2 rounded-full flex items-center ${
              contentTypeFilter === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            All Resources
          </button>
          <button
            onClick={() => setContentTypeFilter('image/')}
            className={`px-4 py-2 rounded-full flex items-center ${
              contentTypeFilter === 'image/'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Images
          </button>
        </div>
      )}
      
      <main>
        {viewMode === 'create' ? (
          <LinkedResourceCreator />
        ) : (
          <LinkedResourceList showAllResources={true} contentTypeFilter={contentTypeFilter} />
        )}
      </main>
    </div>
  );
};

export default LinkedResourcesPage;
