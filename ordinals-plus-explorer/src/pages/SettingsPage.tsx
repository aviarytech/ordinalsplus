import React, { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';
import { ApiProviderType } from '../services/ApiServiceProvider';
import { Network } from '../types';
import { Save, RefreshCw, CheckCircle2, XCircle } from 'lucide-react';

// Map backend network IDs to ApiProviderType
const networkToProviderType: Record<string, ApiProviderType> = {
  'mainnet': ApiProviderType.ORDISCAN,
  'ordRegTestNode': ApiProviderType.ORD_REG_TEST_NODE
};

// Map ApiProviderType to backend network IDs
const providerTypeToNetwork: Record<ApiProviderType, string> = {
  [ApiProviderType.ORDISCAN]: 'mainnet',
  [ApiProviderType.ORD_REG_TEST_NODE]: 'ordRegTestNode'
};

const SettingsPage: React.FC = () => {
  const { currentNetwork, setNetwork, isConnected } = useNetwork();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>(providerTypeToNetwork[currentNetwork]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'success' | 'error' | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // Fetch available networks
  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const response = await fetch('http://localhost:3005/api/networks');
        const data = await response.json();
        setNetworks(data.networks);
      } catch (error) {
        console.error('Failed to fetch networks:', error);
      }
    };

    fetchNetworks();
  }, []);

  // Handle settings save
  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveStatus(null);

    try {
      // Convert selected network ID to ApiProviderType
      const providerType = networkToProviderType[selectedNetwork];
      if (!providerType) {
        throw new Error(`Invalid network selected: ${selectedNetwork}`);
      }

      // Save network selection
      setNetwork(providerType);

      // Save other settings to localStorage
      localStorage.setItem('itemsPerPage', itemsPerPage.toString());
      localStorage.setItem('autoRefresh', autoRefresh.toString());
      localStorage.setItem('refreshInterval', refreshInterval.toString());

      setSaveStatus('success');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Load saved settings
  useEffect(() => {
    const savedItemsPerPage = localStorage.getItem('itemsPerPage');
    const savedAutoRefresh = localStorage.getItem('autoRefresh');
    const savedRefreshInterval = localStorage.getItem('refreshInterval');

    if (savedItemsPerPage) setItemsPerPage(parseInt(savedItemsPerPage));
    if (savedAutoRefresh) setAutoRefresh(savedAutoRefresh === 'true');
    if (savedRefreshInterval) setRefreshInterval(parseInt(savedRefreshInterval));
  }, []);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
        Explorer Settings
      </h1>

      <div className="grid gap-6">
        {/* Network Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Network Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select Network
              </label>
              <select
                value={selectedNetwork}
                onChange={(e) => setSelectedNetwork(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              >
                {networks.map((network) => (
                  <option key={network.id} value={network.id}>
                    {network.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Display Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Items Per Page
              </label>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              >
                {[10, 20, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Auto-Refresh Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Auto-Refresh Settings</h2>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoRefresh"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <label htmlFor="autoRefresh" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable Auto-Refresh
              </label>
            </div>
            {autoRefresh && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Refresh Interval (seconds)
                </label>
                <select
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                  className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                >
                  {[15, 30, 60, 120].map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end space-x-4">
          <button
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Saving...
              </>
            ) : (
              <>
                <Save className="-ml-1 mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </button>
        </div>

        {/* Save Status */}
        {saveStatus && (
          <div className={`flex items-center space-x-2 ${
            saveStatus === 'success' ? 'text-green-600' : 'text-red-600'
          }`}>
            {saveStatus === 'success' ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span>
              {saveStatus === 'success' ? 'Settings saved successfully' : 'Failed to save settings'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage; 