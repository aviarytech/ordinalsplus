import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import DidExplorer from './components/DidExplorer';
import DIDPage from './pages/DIDPage';
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
import { NetworkProvider } from './context/NetworkContext';
import { WalletProvider } from './context/WalletContext';
import { ApiProvider } from './context/ApiContext';
import { ToastProvider } from './contexts/ToastContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import IndexerStatsBar from './components/IndexerStatsBar';
import './index.css';
import BatchInscriptionPage from './pages/BatchInscriptionPage';

function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <NetworkProvider>
          <WalletProvider>
            <ApiProvider>
              <Router>
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                  {/* Navigation */}
                  <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                      <div className="flex justify-between h-16">
                        <div className="flex">
                          <div className="flex-shrink-0 flex items-center">
                            <Link to="/" className="text-xl font-bold text-orange-600 dark:text-orange-400">
                              Ordinals+
                            </Link>
                          </div>
                          <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                            <Link
                              to="/"
                              className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                            >
                              Explorer
                            </Link>
                            <Link to="/create" className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors">Create</Link>
                            <Link to="/batch" className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors">Batch</Link>
                            <Link
                              to="/settings"
                              className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                            >
                              Settings
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </nav>

                  {/* Stats Bar */}
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3">
                    <IndexerStatsBar />
                  </div>

                  {/* Main Content */}
                  <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
                    <Routes>
                      <Route path="/" element={<DidExplorer />} />
                      <Route path="/did-explorer" element={<DidExplorer />} />
                      <Route path="/explorer" element={<DidExplorer />} />
                      <Route path="/did/:didId" element={<DIDPage />} />
                      <Route path="/linked-resources" element={<LinkedResourcesPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/create" element={<CreatePage />} />
                      <Route path="/batch" element={<BatchInscriptionPage />} />
                      <Route path="/create-collection" element={<CreateCollectionPage />} />
                      <Route path="/collections" element={<CollectionsListPage />} />
                      <Route path="/collections/:collectionId" element={<CollectionDetailPage />} />
                      <Route path="/collections-gallery" element={<CollectionsGalleryPage />} />
                      <Route path="/collection-verification" element={<CollectionVerificationPage />} />
                      <Route path="/exchange-participation" element={<ExchangeParticipationPage />} />
                      <Route path="/wallet-utxos" element={<WalletUtxosPage />} />
                    </Routes>
                  </main>
                </div>
              </Router>
            </ApiProvider>
          </WalletProvider>
        </NetworkProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

export default App;
