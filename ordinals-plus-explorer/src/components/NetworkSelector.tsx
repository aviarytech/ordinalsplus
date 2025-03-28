import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { Network, NetworkConfig } from '../types/network';
import { apiClient } from '../services/api';
import { ApiProviderType } from '../services/ApiServiceProvider';

interface NetworkSelectorProps {
  currentNetwork: ApiProviderType;
  onNetworkChange: (network: ApiProviderType) => void;
}

export function NetworkSelector({ onNetworkChange }: NetworkSelectorProps) {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const response = await apiClient.get<NetworkConfig>('/api/networks');
        setNetworks(response.networks);
        setSelectedNetwork(response.defaultNetwork);
      } catch (error) {
        console.error('Failed to fetch networks:', error);
      }
    };

    fetchNetworks();
  }, []);

  const handleNetworkChange = (networkId: string) => {
    setSelectedNetwork(networkId);
    setIsOpen(false);
    onNetworkChange(networkId === 'mainnet' ? ApiProviderType.ORDISCAN : ApiProviderType.ORD_NODE);
  };

  if (networks.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
      >
        {networks.find(n => n.id === selectedNetwork)?.name || 'Select Network'}
        <ChevronDown className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-10 w-56 mt-2 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 dark:bg-gray-800">
          <div className="py-1" role="menu">
            {networks.map((network) => (
              <button
                key={network.id}
                onClick={() => handleNetworkChange(network.id)}
                className={`block w-full px-4 py-2 text-left text-sm ${
                  selectedNetwork === network.id
                    ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
                }`}
                role="menuitem"
              >
                {network.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 