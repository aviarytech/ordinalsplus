import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import ExplorerPage from './pages/ExplorerPage';
import LinkedResourcesPage from './pages/LinkedResourcesPage';
import './index.css';

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    // Check for saved preference or system preference
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode !== null) {
      return savedMode === 'true';
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  useEffect(() => {
    // Apply dark mode to the HTML element
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    // Save preference
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);
  
  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };
  
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-200">
        <div className="fixed top-4 right-4 z-10">
          <button 
            onClick={toggleDarkMode}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 shadow-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>
        
        <nav className="bg-indigo-600 text-white p-4 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center">
            <div className="font-bold text-xl">Ordinals Plus Explorer</div>
            <div className="flex space-x-4">
              <Link to="/" className="hover:text-indigo-200 transition-colors">Explorer</Link>
              <Link to="/resources" className="hover:text-indigo-200 transition-colors">Linked Resources</Link>
            </div>
          </div>
        </nav>
        
        <Routes>
          <Route path="/" element={<ExplorerPage />} />
          <Route path="/resources" element={<LinkedResourcesPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
