import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ExplorerPage from './pages/ExplorerPage';
import LinkedResourcesPage from './pages/LinkedResourcesPage';
import SettingsPage from './pages/SettingsPage';
import CreatePage from './pages/CreatePage';
import CreateCollectionPage from './pages/CreateCollectionPage';
import CollectionsListPage from './pages/CollectionsListPage';
import CollectionDetailPage from './pages/CollectionDetailPage';
import CollectionsGalleryPage from './pages/CollectionsGalleryPage';
import CollectionVerificationPage from './pages/CollectionVerificationPage';
import ExchangeParticipationPage from './pages/ExchangeParticipationPage';
import WalletUtxosPage from './pages/WalletUtxosPage';
import WalletConnector from './components/WalletConnector';
import './index.css';
import ErrorBoundary from './components/ui/ErrorBoundary';
import { ToastProvider } from './contexts/ToastContext';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
            <nav className="bg-gradient-to-r from-orange-400 to-orange-600 text-white p-4 shadow-md">
              <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center">
                <div className="font-bold text-xl">Ordinals Plus Explorer</div>
                <div className="flex items-center space-x-4">
                  <Link to="/" className="text-white hover:text-orange-200 transition-colors font-medium">BTCO DID Resolver</Link>
                  <Link to="/resources" className="text-white hover:text-orange-200 transition-colors">Resources</Link>
                  <Link to="/create" className="text-white hover:text-orange-200 transition-colors">Create</Link>
                  <Link to="/wallet" className="text-white hover:text-orange-200 transition-colors">Wallet</Link>
                  <div className="relative dropdown-container">
                    <Link to="/collections" className="text-white hover:text-orange-200 transition-colors flex items-center dropdown-toggle">
                      Collections
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </Link>
                    <div className="absolute left-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none dropdown-menu z-10">
                      <div className="py-1">
                        <Link to="/collections" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Gallery</Link>
                        <Link to="/collections/list" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">My Collections</Link>
                        <Link to="/collections/create" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Create Collection</Link>
                        <Link to="/collections/verify" className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">Verify Collection</Link>
                      </div>
                    </div>
                  </div>
                  <Link to="/settings" className="text-white hover:text-orange-200 transition-colors">Settings</Link>
                  <WalletConnector compact showAddress />
                </div>
              </div>
            </nav>
            
            <Routes>
              <Route path="/" element={<ExplorerPage />} />
              <Route path="/resources" element={<LinkedResourcesPage />} />
              <Route path="/explorer" element={<ExplorerPage />} />
              <Route path="/create" element={<CreatePage />} />
              <Route path="/wallet" element={<WalletUtxosPage />} />
              <Route path="/collections" element={<CollectionsGalleryPage />} />
              <Route path="/collections/list" element={<CollectionsListPage />} />
              <Route path="/collections/create" element={<CreateCollectionPage />} />
              <Route path="/collections/verify" element={<CollectionVerificationPage />} />
              <Route path="/collections/:id" element={<CollectionDetailPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/exchange/:providerId/:exchangeId" element={<ExchangeParticipationPage />} />
            </Routes>
          </div>
        </Router>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
