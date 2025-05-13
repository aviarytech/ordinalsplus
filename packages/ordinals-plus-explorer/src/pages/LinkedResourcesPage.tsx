import LinkedResourceCreator from '../components/LinkedResourceCreator';
import LinkedResourceList from '../components/LinkedResourceList';
import { useState, useEffect } from 'react';
import { Filter, ListFilter, ImageIcon, FileText, List, Wifi } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useNetwork } from '../context/NetworkContext';
import { useWallet } from '../context/WalletContext';
import { NetworkInfo } from '../types';

// Define constants for filters
const FILTER_ALL = null;
const FILTER_IMAGE = 'image/'; // Assuming API expects prefix match
const FILTER_TEXT = 'text/';   // Assuming API expects prefix match
const ITEMS_PER_PAGE = 20; // Define items per page

const LinkedResourcesPage = () => {
  const [viewMode, setViewMode] = useState<'create' | 'browse'>('browse');
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { network, availableNetworks, setNetwork, loading: loadingNetworks } = useNetwork();
  const { connected: walletConnected } = useWallet();

  // State for current page and filter, driven by URL search params
  const [currentPage, setCurrentPage] = useState<number>(() => parseInt(searchParams.get('page') || '1', 10));
  const [contentTypeFilter, setContentTypeFilter] = useState<string | null>(() => searchParams.get('filter') || FILTER_ALL);

  // Effect to update state when searchParams change (e.g., browser back/forward)
  useEffect(() => {
    const page = parseInt(searchParams.get('page') || '1', 10);
    const filter = searchParams.get('filter') || FILTER_ALL;
    setCurrentPage(page);
    setContentTypeFilter(filter);
  }, [searchParams]);

  // Function to update search params, which triggers state update and data refetch
  const updateSearchParams = (page: number, filter: string | null) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (filter) {
      params.set('filter', filter);
    }
    setSearchParams(params, { replace: true }); // Use replace to avoid large browser history
  };

  const handleFilterChange = (newFilter: string | null) => {
    // When filter changes, always go back to page 1
    updateSearchParams(1, newFilter);
  };

  const handlePageChange = (newPage: number) => {
    // When page changes, keep the current filter
    updateSearchParams(newPage, contentTypeFilter);
  };

  // Helper to get button classes based on active filter
  const getButtonClass = (filterType: string | null): string => {
    const baseClass = 'px-4 py-2 rounded-full flex items-center transition-colors duration-150';
    const activeClass = 'bg-gradient-to-r from-orange-500 to-orange-600 text-white';
    const inactiveClass = 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600';
    return `${baseClass} ${contentTypeFilter === filterType ? activeClass : inactiveClass}`;
  };

  // Determine if network selection should be disabled
  const isNetworkSelectionDisabled = loadingNetworks || walletConnected;

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
      
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleFilterChange(FILTER_ALL)}
            className={getButtonClass(FILTER_ALL)}
          >
            <List className="h-4 w-4 mr-2" />
            All Resources
          </button>
          <button
            onClick={() => handleFilterChange(FILTER_IMAGE)}
            className={getButtonClass(FILTER_IMAGE)}
          >
            <ImageIcon className="h-4 w-4 mr-2" />
            Images
          </button>
          <button
            onClick={() => handleFilterChange(FILTER_TEXT)}
            className={getButtonClass(FILTER_TEXT)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Text
          </button>
        </div>
        
        {/* Network Selection Dropdown */}
        <div className="flex items-center text-sm">
           <Wifi className={`w-4 h-4 mr-2 ${isNetworkSelectionDisabled ? 'text-gray-400 dark:text-gray-500' : 'text-orange-500'}`} />
           <label htmlFor="network-resource-select" className="mr-2 text-gray-500 dark:text-gray-400">Network:</label>
           <select
             id="network-resource-select"
             value={network?.id || ''} // Controlled by active network context
             onChange={(e) => {
               const selectedId = e.target.value;
               // Find the full NetworkInfo object from the available list
               const networkToSet = availableNetworks.find((n: NetworkInfo) => n.id === selectedId) || null;
               // Call the context setter
               setNetwork(networkToSet); 
             }}
             disabled={isNetworkSelectionDisabled}
             className={`py-1 pl-2 pr-8 border rounded-md shadow-sm text-sm focus:ring-orange-500 focus:border-orange-500 
                         ${isNetworkSelectionDisabled 
                           ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-70 text-gray-500 dark:text-gray-400' 
                           : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
             aria-label="Select Network"
           >
            {/* Handle loading state */}
            {loadingNetworks && <option>Loading...</option>}
            
            {/* Populate dropdown from availableNetworks */}
            {!loadingNetworks && availableNetworks.map((net: NetworkInfo) => (
              <option key={net.id} value={net.id}>
                {net.name}
              </option>
            ))}
           </select>
         </div>
      </div>
      
      <main>
        <LinkedResourceList 
          currentPage={currentPage}
          contentTypeFilter={contentTypeFilter}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={handlePageChange}
        />
      </main>
    </div>
  );
};

export default LinkedResourcesPage;
