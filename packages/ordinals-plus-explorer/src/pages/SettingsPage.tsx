import React from 'react';
import { useNetwork } from '../context/NetworkContext';
import { NetworkInfo } from '../types/index';
import { useWallet } from '../context/WalletContext';
import { Loader2, Wifi, Key } from 'lucide-react';
import VCApiProviderSettings from '../components/settings/VCApiProviderSettings';

const SettingsPage: React.FC = () => {
  const {
    network: activeNetwork,
    availableNetworks,
    setNetwork: setSelectedNetworkContext,
    loading: loadingNetworks,
    error: networkError
  } = useNetwork();
  
  const { connected: walletConnected, network: walletNetwork } = useWallet();
  
  // Determine if network selection should be disabled (when wallet is connected)
  const isNetworkSelectionDisabled = walletConnected;
  
  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-200">Settings</h1>

      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 flex items-center">
          <Wifi className="w-5 h-5 mr-2" /> Network Settings
        </h2>
        
        {/* Loading State */} 
        {loadingNetworks && (
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
            <Loader2 className="animate-spin h-4 w-4 mr-2" /> Loading available networks...
          </div>
        )}
        
        {/* Error State */} 
        {networkError && !loadingNetworks && (
          <div className="text-sm text-red-600 dark:text-red-400 mb-4">
            Error loading networks: {networkError}
          </div>
        )}

        {/* Network Selection Dropdown */} 
        {!loadingNetworks && availableNetworks.length > 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="network-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Active Network
              </label>
              <select
                id="network-select"
                value={activeNetwork?.id || ''} // Controlled by activeNetwork from context
                onChange={(e) => {
                  const selectedId = e.target.value;
                  // Find the full NetworkInfo object from the available list
                  const networkToSet = availableNetworks.find((n: NetworkInfo) => n.id === selectedId) || null;
                  // Call the context setter (which checks if wallet is connected)
                  setSelectedNetworkContext(networkToSet); 
                }}
                disabled={isNetworkSelectionDisabled} // Disable if wallet connected
                className={`block w-full p-2 border rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm 
                            ${isNetworkSelectionDisabled 
                              ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-70' 
                              : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600'}`}
              >
                {/* Populate dropdown from availableNetworks */} 
                {availableNetworks.map((net: NetworkInfo) => ( // Add type annotation
                  <option key={net.id} value={net.id}>
                    {net.name}
                  </option>
                ))}
              </select>
              
              {/* Informational message when disabled */} 
              {isNetworkSelectionDisabled && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Network selection follows the connected wallet ({walletNetwork || 'Unknown'}). Disconnect wallet to change manually.
                </p>
              )}
              
              {/* Warning if wallet network and selected context network mismatch (can happen briefly or if context fallback used) */} 
              {walletConnected && activeNetwork && walletNetwork && activeNetwork.id.toLowerCase() !== walletNetwork.toLowerCase() && (
                 <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400">
                    Warning: Wallet is connected to {walletNetwork}, but the active context is {activeNetwork.id}. API calls might target the wrong network.
                 </p>
              )}
            </div>
          </div>
        )}
        
        {/* Message if no networks loaded */} 
         {!loadingNetworks && availableNetworks.length === 0 && !networkError && (
             <div className="text-sm text-gray-500 dark:text-gray-400">
                No networks available or failed to load.
             </div>
         )}
      </div>

      {/* VC API Provider Settings */}
      <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300 flex items-center">
          <Key className="w-5 h-5 mr-2" /> Verifiable Credential API Providers
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Configure API providers for verifiable credentials. These settings will be used when creating resources with verifiable credential metadata.
        </p>
        
        <div className="mt-4">
          <VCApiProviderSettings />
        </div>
      </div>

      {/* Removed other settings sections (Display, Auto-Refresh, Save) */}
    </div>
  );
};

export default SettingsPage; 