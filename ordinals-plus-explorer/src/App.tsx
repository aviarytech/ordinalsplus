import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ExplorerPage from './pages/ExplorerPage';
import LinkedResourcesPage from './pages/LinkedResourcesPage';
import { NetworkProvider } from './context/NetworkContext';
import './index.css';

function App() {
  return (
    <NetworkProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
          <nav className="bg-gradient-to-r from-orange-400 to-orange-600 text-white p-4 shadow-md">
            <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center">
              <div className="font-bold text-xl">Ordinals Plus Explorer</div>
              <div className="flex space-x-4">
                <Link to="/" className="text-white hover:text-orange-200 transition-colors">Explorer</Link>
                <Link to="/resources" className="text-white hover:text-orange-200 transition-colors">Linked Resources</Link>
              </div>
            </div>
          </nav>
          
          <Routes>
            <Route path="/" element={<ExplorerPage />} />
            <Route path="/resources" element={<LinkedResourcesPage />} />
          </Routes>
        </div>
      </Router>
    </NetworkProvider>
  );
}

export default App;
