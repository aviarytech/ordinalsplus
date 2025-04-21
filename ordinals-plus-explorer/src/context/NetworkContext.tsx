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

interface NetworkContextType {
  network: NetworkInfo | null; // The *active* network (from wallet if connected, or selected)
  availableNetworks: NetworkInfo[];
  setNetwork: (network: NetworkInfo | null) => void; // Allow manual setting *only* for viewing?
  loading: boolean;
  error: string | null;
}

const NetworkContext = createContext<NetworkContextType>({
  network: null,
  availableNetworks: [],
  setNetwork: () => {},
  loading: false,
  error: null,
});

export const NetworkProvider: React.FC<{children: ReactNode}> = ({ children }) => {
  const [availableNetworks, setAvailableNetworks] = useState<NetworkInfo[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { apiService } = useApi(); // Get the apiService instance
  const { connected: walletConnected, network: walletNetwork } = useWallet(); // Get wallet state

  // Fetch available networks from API on mount
  useEffect(() => {
    if (!apiService) {
      setError("ApiService not available for fetching networks.");
      setLoading(false);
      return; 
    }

    const fetchNetworks = async () => { 
      setLoading(true);
      setError(null);
      try {
        const networksResult = await apiService.getNetworks(); 
        setAvailableNetworks(networksResult || []);
        
        if (!selectedNetwork && networksResult && networksResult.length > 0) {
          const mainnet = networksResult.find((n: NetworkInfo) => n.type === 'mainnet'); 
          const testnet = networksResult.find((n: NetworkInfo) => n.type === 'testnet'); 
          const defaultNetwork = mainnet || testnet || networksResult[0];
          setSelectedNetwork(defaultNetwork);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load networks');
        setAvailableNetworks([]); 
      } finally {
        setLoading(false);
      }
    };

    fetchNetworks();
  }, [apiService, selectedNetwork]);

  // Determine the *active* network
  const activeNetwork = React.useMemo(() => {
    if (walletConnected && walletNetwork && availableNetworks.length > 0) {
      // Wallet is connected, find the matching available network
      const matchedNetwork = availableNetworks.find(
        (n: NetworkInfo) => n.type.toLowerCase() === walletNetwork.toLowerCase() // Add type annotation
      );
      if (matchedNetwork) {
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
        console.log(`[NetworkContext] Manually setting network to: ${network?.name}`);
        setSelectedNetwork(network);
    } else {
        console.warn('[NetworkContext] Cannot manually set network while wallet is connected.');
    }
  };

  return (
    <NetworkContext.Provider value={{
      network: activeNetwork, // Provide the derived active network
      availableNetworks,
      setNetwork: handleSetNetwork, // Provide the guarded setter
      loading,
      error
    }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext); 