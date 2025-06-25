import React, { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { useApi } from '../context/ApiContext';
import { useNetwork } from '../context/NetworkContext';
import { Button } from '../components/ui';
import WalletConnector from '../components/WalletConnector';
import { Utxo } from '../context/WalletContext';
import { Bitcoin, Coins, Shield, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';

// Enhanced UTXO type with classification
interface ClassifiedUtxo extends Utxo {
  type: 'regular' | 'inscription' | 'ordinals-plus';
  inscriptionId?: string;
  inscriptionNumber?: number;
  contentType?: string;
  isOrdinalsPlusAsset?: boolean;
  resourceMetadata?: any;
}

// Simple inscription data interface
interface InscriptionData {
  id: string;
  location: string;
  number?: number;
  content_type?: string;
}

/**
 * Component to display individual UTXO cards
 */
const UtxoCard: React.FC<{ utxo: ClassifiedUtxo }> = ({ utxo }) => {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatSatoshis = (sats: number) => {
    return (sats / 100000000).toFixed(8);
  };

  const formatTxid = (txid: string) => {
    return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
  };

  const getTypeIcon = () => {
    switch (utxo.type) {
      case 'regular':
        return <Bitcoin className="w-5 h-5 text-orange-500" />;
      case 'inscription':
        return <Coins className="w-5 h-5 text-purple-500" />;
      case 'ordinals-plus':
        return <Shield className="w-5 h-5 text-green-500" />;
      default:
        return <Bitcoin className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTypeLabel = () => {
    switch (utxo.type) {
      case 'regular':
        return 'Regular UTXO';
      case 'inscription':
        return 'Ordinal Inscription';
      case 'ordinals-plus':
        return 'Ordinals+ Asset';
      default:
        return 'Unknown';
    }
  };

  const getTypeBadgeColor = () => {
    switch (utxo.type) {
      case 'regular':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'inscription':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300';
      case 'ordinals-plus':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow">
      {/* Header with type indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {getTypeIcon()}
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor()}`}>
            {getTypeLabel()}
          </span>
        </div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {formatSatoshis(utxo.value)} BTC
        </div>
      </div>

      {/* Transaction details */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Transaction:</span>
          <div className="flex items-center gap-1">
            <code className="text-xs text-gray-700 dark:text-gray-300">
              {formatTxid(utxo.txid)}:{utxo.vout}
            </code>
            <button
              onClick={() => copyToClipboard(`${utxo.txid}:${utxo.vout}`, 'location')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {copied === 'location' ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">Value:</span>
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {utxo.value.toLocaleString()} sats
          </span>
        </div>

        {/* Additional details for inscriptions */}
        {utxo.type !== 'regular' && (
          <>
            {utxo.inscriptionId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Inscription ID:</span>
                <div className="flex items-center gap-1">
                  <code className="text-xs text-gray-700 dark:text-gray-300">
                    {formatTxid(utxo.inscriptionId)}
                  </code>
                  <button
                    onClick={() => copyToClipboard(utxo.inscriptionId!, 'inscription')}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {copied === 'inscription' ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {utxo.inscriptionNumber && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Inscription #:</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  #{utxo.inscriptionNumber}
                </span>
              </div>
            )}

            {utxo.contentType && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 dark:text-gray-400">Content Type:</span>
                <span className="text-xs text-gray-700 dark:text-gray-300">
                  {utxo.contentType}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(`https://mempool.space/tx/${utxo.txid}`, '_blank')}
          className="flex items-center gap-1 text-xs"
        >
          <ExternalLink className="w-3 h-3" />
          View TX
        </Button>
        
        {utxo.type !== 'regular' && utxo.inscriptionId && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://ordinals.com/inscription/${utxo.inscriptionId}`, '_blank')}
            className="flex items-center gap-1 text-xs"
          >
            <ExternalLink className="w-3 h-3" />
            View Inscription
          </Button>
        )}
      </div>
    </div>
  );
};

/**
 * Main wallet UTXOs page component
 */
const WalletUtxosPage: React.FC = () => {
  const { connected, address, walletType, network: walletNetwork } = useWallet();
  const { apiService } = useApi();
  const { network } = useNetwork();
  
  const [utxos, setUtxos] = useState<ClassifiedUtxo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'regular' | 'inscription' | 'ordinals-plus'>('all');

  // Get the current network type for API calls
  const currentNetworkType = walletNetwork || network?.type || 'mainnet';

  // Fetch and classify UTXOs
  const fetchUtxos = async () => {
    if (!connected || !address || !apiService) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get all UTXOs from mempool API (not the filtered version)
      const networkUrl = currentNetworkType === 'testnet' 
        ? 'https://mempool.space/testnet/api'
        : currentNetworkType === 'signet'
        ? 'https://mempool.space/signet/api'
        : 'https://mempool.space/api';
      
      const response = await fetch(`${networkUrl}/address/${address}/utxo`);
      if (!response.ok) {
        throw new Error(`Failed to fetch UTXOs: ${response.status}`);
      }
      const allUtxos: Utxo[] = await response.json();

      // Get inscriptions for this address to identify ordinal UTXOs
      let inscriptionLocations: { [key: string]: InscriptionData } = {};
      try {
        // Fetch inscriptions from our API
        const inscriptionResponse = await fetch(`${apiService.getConfig().baseUrl}/api/addresses/${address}/inscriptions?network=${currentNetworkType}`);
        if (inscriptionResponse.ok) {
          const inscriptions = await inscriptionResponse.json();
          // Convert to location lookup map
          if (inscriptions.data && Array.isArray(inscriptions.data)) {
            inscriptions.data.forEach((inscription: any) => {
              if (inscription.owner_output) {
                inscriptionLocations[inscription.owner_output] = {
                  id: inscription.id,
                  location: inscription.owner_output,
                  number: inscription.number,
                  content_type: inscription.content_type
                };
              }
            });
          }
        }
      } catch (inscErr) {
        console.warn('Failed to fetch inscription locations:', inscErr);
      }

      // Classify each UTXO
      const classifiedUtxos: ClassifiedUtxo[] = await Promise.all(
        allUtxos.map(async (utxo): Promise<ClassifiedUtxo> => {
          const locationKey = `${utxo.txid}:${utxo.vout}`;
          const inscriptionData = inscriptionLocations[locationKey];

          if (inscriptionData) {
            // This is an ordinal inscription
            let isOrdinalsPlusAsset = false;
            let resourceMetadata = null;

            // Try to determine if it's an Ordinals+ asset by checking for linked resource metadata
            try {
              if (inscriptionData.id) {
                // Check if this inscription has associated resources (making it an Ordinals+ asset)
                const resourceResponse = await fetch(`${apiService.getConfig().baseUrl}/api/resources?inscriptionId=${inscriptionData.id}&network=${currentNetworkType}`);
                if (resourceResponse.ok) {
                  const resourceData = await resourceResponse.json();
                  if (resourceData.data && resourceData.data.length > 0) {
                    isOrdinalsPlusAsset = true;
                    resourceMetadata = resourceData.data[0];
                  }
                }
              }
            } catch (metaErr) {
              console.warn('Failed to fetch resource metadata:', metaErr);
            }

            return {
              ...utxo,
              type: isOrdinalsPlusAsset ? 'ordinals-plus' : 'inscription',
              inscriptionId: inscriptionData.id,
              inscriptionNumber: inscriptionData.number,
              contentType: inscriptionData.content_type,
              isOrdinalsPlusAsset,
              resourceMetadata
            };
          } else {
            // Regular UTXO
            return {
              ...utxo,
              type: 'regular'
            };
          }
        })
      );

      setUtxos(classifiedUtxos);
    } catch (err) {
      console.error('Error fetching UTXOs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch UTXOs');
    } finally {
      setLoading(false);
    }
  };

  // Load UTXOs when wallet connects
  useEffect(() => {
    fetchUtxos();
  }, [connected, address, currentNetworkType]);

  // Filter UTXOs based on selected filter
  const filteredUtxos = utxos.filter(utxo => {
    if (filter === 'all') return true;
    return utxo.type === filter;
  });

  // Calculate totals
  const totals = {
    all: utxos.length,
    regular: utxos.filter(u => u.type === 'regular').length,
    inscription: utxos.filter(u => u.type === 'inscription').length,
    'ordinals-plus': utxos.filter(u => u.type === 'ordinals-plus').length,
    totalValue: utxos.reduce((sum, u) => sum + u.value, 0)
  };

  if (!connected) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Wallet UTXOs
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Connect your wallet to view all UTXOs including regular BTC, ordinal inscriptions, and Ordinals+ assets.
            </p>
            <WalletConnector />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Wallet UTXOs
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Connected to {walletType} • {address} • {currentNetworkType}
            </p>
          </div>
          <Button
            onClick={fetchUtxos}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Bitcoin className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Total UTXOs</span>
            </div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{totals.all}</div>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Bitcoin className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span className="text-sm font-medium text-orange-600 dark:text-orange-400">Regular</span>
            </div>
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">{totals.regular}</div>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-600 dark:text-purple-400">Inscriptions</span>
            </div>
            <div className="text-xl font-bold text-purple-900 dark:text-purple-100">{totals.inscription}</div>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-600 dark:text-green-400">Ordinals+</span>
            </div>
            <div className="text-xl font-bold text-green-900 dark:text-green-100">{totals['ordinals-plus']}</div>
          </div>
        </div>

        {/* Total Value */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Value</span>
            <div className="text-right">
              <div className="text-lg font-bold text-blue-900 dark:text-blue-100">
                {(totals.totalValue / 100000000).toFixed(8)} BTC
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                {totals.totalValue.toLocaleString()} sats
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'All UTXOs', count: totals.all },
            { key: 'regular', label: 'Regular', count: totals.regular },
            { key: 'inscription', label: 'Inscriptions', count: totals.inscription },
            { key: 'ordinals-plus', label: 'Ordinals+', count: totals['ordinals-plus'] }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">Loading UTXOs...</p>
          </div>
        )}

        {/* UTXOs Grid */}
        {!loading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredUtxos.map((utxo, index) => (
              <UtxoCard key={`${utxo.txid}:${utxo.vout}`} utxo={utxo} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredUtxos.length === 0 && (
          <div className="text-center py-8">
            <Bitcoin className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-gray-400">
              {filter === 'all' ? 'No UTXOs found' : `No ${filter} UTXOs found`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletUtxosPage; 