import LinkedResourceCreator from '../components/LinkedResourceCreator';
import LinkedResourceList from '../components/LinkedResourceList';
import { useState, useEffect } from 'react';
import { Filter, ListFilter, ImageIcon, FileText } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const LinkedResourcesPage = () => {
  const [viewMode, setViewMode] = useState<'create' | 'browse'>('browse');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Get page from URL or default to 1 (API is 1-based)
  const currentPage = parseInt(searchParams.get('page') || '1', 10);
  const filter = searchParams.get('filter');
  
  // Initialize contentTypeFilter from URL
  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(filter);

  // Update filter state when URL changes
  useEffect(() => {
    setContentTypeFilter(filter);
  }, [filter]);

  return (
    <div className="max-w-7xl mx-auto p-5">
      {/* <header className="mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">Ordinals Plus Linked Resources</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => setViewMode('browse')}
              className={`px-4 py-2 rounded-full flex items-center ${
                viewMode === 'browse' 
                  ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <ListFilter className="h-4 w-4 mr-2" />
              Browse
            </button>
          </div>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
          Browse Linked Resources on the Bitcoin Ordinals network
        </p>
      </header> */}
      
      <div className="flex mb-6 space-x-2">
        <button
          hx-get={`/api/resources?page=1&limit=20`}
          hx-target="#resources-list"
          hx-swap="innerHTML"
          className={`px-4 py-2 rounded-full flex items-center ${
            contentTypeFilter === null
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          All Resources
        </button>
        <button
          hx-get={`/api/resources?page=1&limit=20&contentType=image/`}
          hx-target="#resources-list"
          hx-swap="innerHTML"
          className={`px-4 py-2 rounded-full flex items-center ${
            contentTypeFilter === 'image/'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <ImageIcon className="h-4 w-4 mr-2" />
          Images
        </button>
        <button
          hx-get={`/api/resources?page=1&limit=20&contentType=text/`}
          hx-target="#resources-list"
          hx-swap="innerHTML"
          className={`px-4 py-2 rounded-full flex items-center ${
            contentTypeFilter === 'text/'
              ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          <FileText className="h-4 w-4 mr-2" />
          Text
        </button>
      </div>
      
      <main>
        <LinkedResourceList 
          showAllResources={true} 
          contentTypeFilter={contentTypeFilter}
          currentPage={currentPage}
        />
      </main>
    </div>
  );
};

export default LinkedResourcesPage;
