import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useWallet } from './WalletContext'; // Import useWallet to get wallet network
import { useApi } from './ApiContext';
import { NetworkInfo } from '../types/index'; // Import NetworkInfo from correct path

// REMOVE local definition - Use imported version
/*
export interface NetworkInfo {
  id: string;
  name: string;
  type: 'mainnet' | 'testnet' | 'regtest'; // Add network type
  apiUrl: string; // Base API URL for this network
}
*/

// LocalStorage key
const LOCAL_STORAGE_NETWORK_KEY = 'ordinalsplus_selected_network_id';

// Define static default networks
const DEFAULT_MAINNET_NETWORK: NetworkInfo = {
  id: 'mainnet', 
  name: 'Bitcoin Mainnet',
  type: 'mainnet',
};
const DEFAULT_SIGNET_NETWORK: NetworkInfo = {
  id: 'signet', 
  name: 'Bitcoin Signet',
  type: 'signet',
};

// Define a list of potential initial networks for context default
const POTENTIAL_INITIAL_NETWORKS = [DEFAULT_MAINNET_NETWORK, DEFAULT_SIGNET_NETWORK];

interface NetworkContextType {
  network: NetworkInfo | null; // The *active* network (from wallet if connected, or selected)
  availableNetworks: NetworkInfo[];
  setNetwork: (network: NetworkInfo | null) => void; // Allow manual setting *only* for viewing?
  loading: boolean;
  error: string | null;
}

// Function to get initial network from localStorage or default
const getInitialNetwork = (): NetworkInfo => {
  try {
    const storedId = localStorage.getItem(LOCAL_STORAGE_NETWORK_KEY);
    console.log(`[NetworkContext Init] Found stored ID: ${storedId}`);
    if (storedId === 'signet') {
      console.log(`[NetworkContext Init] Loading Signet from storage.`);
      return DEFAULT_SIGNET_NETWORK;
    } else if (storedId === 'mainnet') {
      console.log(`[NetworkContext Init] Loading Mainnet from storage.`);
       return DEFAULT_MAINNET_NETWORK;
    }
    // Fallback to mainnet if stored value is invalid or not found
    console.log('[NetworkContext Init] No valid network ID in localStorage, defaulting to mainnet.');
    return DEFAULT_MAINNET_NETWORK;
  } catch (e) {
      console.error("[NetworkContext Init] Error reading localStorage:", e);
      return DEFAULT_MAINNET_NETWORK; // Default on error
  }
};

const NetworkContext = createContext<NetworkContextType>({
  // Initialize context value based on localStorage or default
  network: getInitialNetwork(), 
  // Include all potential defaults initially, will be replaced by fetch
  availableNetworks: POTENTIAL_INITIAL_NETWORKS, 
  setNetwork: () => {},
  loading: true, 
  error: null,
});

export const NetworkProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  // Initialize states using the function/constants
  const [availableNetworks, setAvailableNetworks] = useState<NetworkInfo[]>(POTENTIAL_INITIAL_NETWORKS);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkInfo | null>(getInitialNetwork());
  
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState<string | null>(null);
  const { apiService } = useApi();
  const { connected: walletConnected, network: walletNetwork } = useWallet();

  // Fetch available networks from API on mount to *update* the list
  useEffect(() => {
    // Fetch only if apiService is available 
    // We fetch even if networks exist to potentially get updates
    if (!apiService) { 
      console.log('[NetworkContext] ApiService not ready, skipping fetch.');
      setLoading(false); // Stop loading if we can't fetch
      setError("ApiService not available for fetching networks."); 
      return; 
    }

    let isMounted = true; // Flag to prevent state updates on unmounted component

    const fetchNetworks = async () => { 
      // Keep loading true if it wasn't already false
      if (isMounted) setLoading(true); 
      console.log('[NetworkContext] Starting fetchNetworks...');
      setError(null); // Clear previous errors on new fetch attempt
      try {
        const networksResult = await apiService.getNetworks(); 
        if (!isMounted) return; // Check if component unmounted during fetch

        const fetchedNetworks = networksResult || [];
        console.log('[NetworkContext] Fetched networks:', fetchedNetworks);
        setAvailableNetworks(fetchedNetworks); // Update available networks list

        // --- Logic to reconcile initial/stored selection with fetched list --- 
        const initialSelectedId = selectedNetwork?.id; // ID from localStorage/default
        let currentSelectionStillValid = false;
        let updatedSelectedNetwork = null;

        if (initialSelectedId) {
            updatedSelectedNetwork = fetchedNetworks.find(net => net.id === initialSelectedId);
            if (updatedSelectedNetwork) {
                currentSelectionStillValid = true;
                console.log(`[NetworkContext] Initial selection '${initialSelectedId}' still valid in fetched list.`);
                setSelectedNetwork(updatedSelectedNetwork); // Ensure we use the object from fetched list
            }
        }

        // If initial selection wasn't valid or none was stored/set, pick a new default
        if (!currentSelectionStillValid && fetchedNetworks.length > 0) {
            console.log('[NetworkContext] Initial selection invalid or none set, setting default from fetched list.');
            const mainnet = fetchedNetworks.find((n: NetworkInfo) => n.type === 'mainnet'); 
            const newDefault = mainnet || fetchedNetworks[0]; // Default to mainnet or the first available
            setSelectedNetwork(newDefault);
            // Save the newly determined default to localStorage if it wasn't the initial one?
            // Maybe only save explicitly selected ones?
        } else if (!currentSelectionStillValid && fetchedNetworks.length === 0) {
             console.log('[NetworkContext] No networks fetched, keeping initial default (if any).');
            if(fetchedNetworks.length === 0) setError('No networks returned from API.');
            // Ensure availableNetworks isn't empty if fetch fails
            if (availableNetworks.length === 0) setAvailableNetworks([DEFAULT_MAINNET_NETWORK]);
        } else {
           // Initial selection was valid and found in the list - state already updated above
        }

      } catch (err) {
        if (!isMounted) return;
        console.error('[NetworkContext] Error fetching networks:', err);
        setError(err instanceof Error ? err.message : 'Failed to load networks');
        // Keep the initial default availableNetwork if fetch fails?
        // setAvailableNetworks([DEFAULT_MAINNET_NETWORK]); 
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchNetworks();

    // Cleanup function to set isMounted to false when the component unmounts
    return () => { 
      isMounted = false; 
      console.log('[NetworkContext] Unmounting, fetch cancelled/ignored.');
    };
    // Only depend on apiService. Fetch should run once apiService is available.
  }, [apiService]); // Effect only runs once when apiService is ready

  // Determine the *active* network
  const activeNetwork = React.useMemo(() => {
    if (walletConnected && walletNetwork && availableNetworks.length > 0) {
      // Wallet is connected, find the matching available network by type
      const matchedNetwork = availableNetworks.find(
        (n: NetworkInfo) => n.type.toLowerCase() === walletNetwork.toLowerCase() // Case-insensitive type matching
      );
      if (matchedNetwork) {
        // If wallet is on signet, this *should* find either API-provided signet or our local one
        return matchedNetwork;
      } else {
        // Wallet connected to an unsupported/unknown network
        console.warn(`[NetworkContext] Wallet connected to unsupported network: ${walletNetwork}. Falling back.`);
        // Fallback logic: Use the previously selected network or default?
        // For now, let's keep the selectedNetwork to allow browsing, but indicate mismatch?
        return selectedNetwork; // Or return null to force selection?
      }
    } else {
      // Wallet disconnected, use the manually selected network
      console.log(`[NetworkContext] Wallet disconnected, using selected network: ${selectedNetwork?.name}`);
      return selectedNetwork;
    }
  }, [walletConnected, walletNetwork, availableNetworks, selectedNetwork]);

  // Function to manually set network (primarily for disconnected state)
  const handleSetNetwork = (network: NetworkInfo | null) => {
    if (!walletConnected) {
        console.log(`[NetworkContext] Manually setting network to: ${network?.name} (ID: ${network?.id})`);
        setSelectedNetwork(network);
        // --- Save to localStorage --- 
        if (network) {
            try {
                localStorage.setItem(LOCAL_STORAGE_NETWORK_KEY, network.id);
                console.log(`[NetworkContext] Saved network ID '${network.id}' to localStorage.`);
                // Also persist legacy key used by ApiService fallback
                localStorage.setItem('currentNetwork', network.id);
            } catch (e) {
                console.error("[NetworkContext] Error saving to localStorage:", e);
            }
        } else {
             // Handle case where selection is cleared (e.g., remove from storage?)
             try {
                 localStorage.removeItem(LOCAL_STORAGE_NETWORK_KEY);
                 localStorage.removeItem('currentNetwork');
                 console.log('[NetworkContext] Cleared network selection from localStorage.');
             } catch (e) {
                 console.error("[NetworkContext] Error removing from localStorage:", e);
             }
        }
    } else {
        console.warn('[NetworkContext] Cannot manually set network while wallet is connected.');
    }
  };

  // Memoize the context value to prevent unnecessary re-renders in consumers
  const contextValue = React.useMemo(() => ({
    network: activeNetwork, // Provide the derived active network
    availableNetworks,
    setNetwork: handleSetNetwork, // Provide the guarded setter
    loading,
    error
  }), [activeNetwork, availableNetworks, handleSetNetwork, loading, error]); // Dependencies for the memoized value

  return (
    <NetworkContext.Provider value={contextValue}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext); 