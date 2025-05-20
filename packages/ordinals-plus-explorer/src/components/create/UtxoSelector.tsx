import React, { useState, useMemo } from 'react';
import { Utxo } from '../../context/WalletContext';
import { Loader2, Wallet, AlertCircle, Info, Check, Filter, SortDesc, SortAsc, RefreshCw } from 'lucide-react';
import { truncateMiddle } from '../../utils/string';
import { Tooltip } from '../ui';

/**
 * Extended UTXO interface to include optional status properties used by the selector
 */
interface ExtendedUtxo extends Utxo {
  status?: {
    confirmed?: boolean;
    block_height?: number;
    [key: string]: any;
  };
}

/**
 * Props for UtxoSelector component.
 */
export interface UtxoSelectorProps {
  walletConnected: boolean;
  utxos: ExtendedUtxo[];
  selectedUtxos: ExtendedUtxo[];
  isFetchingUtxos: boolean;
  utxoError: string | null;
  flowState: string;
  onFetchUtxos: () => void;
  onUtxoSelectionChange: (utxo: ExtendedUtxo, isSelected: boolean) => void;
  requiredAmount?: number; // Optional: Suggested amount required for the inscription
}

// Types for sorting and filtering
type SortField = 'value' | 'age';
type SortDirection = 'asc' | 'desc';
type FilterOption = 'all' | 'recommended' | 'confirmed';

/**
 * UtxoSelector handles fetching, filtering, and selecting UTXOs for resource creation.
 */
const UtxoSelector: React.FC<UtxoSelectorProps> = ({
  walletConnected,
  utxos,
  selectedUtxos,
  isFetchingUtxos,
  utxoError,
  flowState,
  onFetchUtxos,
  onUtxoSelectionChange,
  requiredAmount = 0,
}) => {
  // State for sorting and filtering
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterOption, setFilterOption] = useState<FilterOption>('all');
  const [showGuidance, setShowGuidance] = useState(false);

  // Calculate the total value of selected UTXOs
  const totalSelectedValue = useMemo(() => 
    selectedUtxos.reduce((sum, utxo) => sum + utxo.value, 0),
    [selectedUtxos]
  );

  // Check if a UTXO is recommended based on certain criteria
  const isRecommendedUtxo = (utxo: ExtendedUtxo): boolean => {
    // For inscription, UTXOs without previous inscriptions are recommended
    // We could add more sophisticated recommendations based on:
    // - Value (enough for inscription but not too much)
    // - Age (prefer older UTXOs to avoid recent change outputs)
    // - Confirmation status (prefer confirmed UTXOs)
    return (
      // Prefer UTXOs that are confirmed (if status is available)
      (utxo.status?.confirmed === true) && 
      // For inscription purposes, prefer UTXOs that are large enough but not excessively large
      utxo.value >= (requiredAmount > 0 ? requiredAmount : 10000) && 
      utxo.value <= (requiredAmount > 0 ? requiredAmount * 3 : 100000)
    );
  };

  // Filter and sort UTXOs
  const processedUtxos = useMemo(() => {
    // First apply filters
    let filtered = [...utxos];
    
    if (filterOption === 'recommended') {
      filtered = filtered.filter(isRecommendedUtxo);
    } else if (filterOption === 'confirmed') {
      filtered = filtered.filter(utxo => utxo.status?.confirmed === true);
    }
    
    // Then sort
    return filtered.sort((a, b) => {
      if (sortField === 'value') {
        return sortDirection === 'desc' ? b.value - a.value : a.value - b.value;
      } else if (sortField === 'age') {
        // Using blockHeight as a proxy for age if available
        const aHeight = a.status?.block_height || 0;
        const bHeight = b.status?.block_height || 0;
        return sortDirection === 'desc' ? aHeight - bHeight : bHeight - aHeight;
      }
      return 0;
    });
  }, [utxos, sortField, sortDirection, filterOption]);

  // Generate a UTXO ID for display purposes
  const getUtxoDisplayId = (utxo: ExtendedUtxo): string => {
    return `${truncateMiddle(utxo.txid, 8)}:${utxo.vout}`;
  };

  // Format satoshi values to BTC
  const formatBtcValue = (satoshis: number): string => {
    return (satoshis / 100_000_000).toFixed(8);
  };

  // Helper to toggle sort direction or change sort field
  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  if (!walletConnected) return null;

  return (
    <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">
          <Tooltip
            content={
              <div>
                <p>UTXOs (Unspent Transaction Outputs) are individual units of Bitcoin that can be spent.</p>
                <p className="mt-1">For ordinals inscriptions, the first UTXO you select will hold your inscription.</p>
                <p className="mt-1">Choose carefully as the UTXO characteristics will determine the properties of your inscription.</p>
              </div>
            }
            position="top"
            showIcon={true}
          >
            Select Funding UTXOs
          </Tooltip>
        </h3>
        <button
          type="button"
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          onClick={() => setShowGuidance(!showGuidance)}
          aria-label={showGuidance ? "Hide guidance" : "Show guidance"}
        >
          <Info className="h-5 w-5" />
        </button>
      </div>
      
      {/* Enhanced guidance panel */}
      {showGuidance && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md text-sm text-blue-800 dark:text-blue-200">
          <h4 className="font-medium mb-2">UTXO Selection Guide</h4>
          <p className="mb-2">Choosing the right UTXOs is critical for your inscription:</p>
          <ul className="list-disc list-inside space-y-1 mb-2">
            <li>
              <Tooltip
                content="The first UTXO you select becomes the 'home' for your ordinal inscription. Only this UTXO will contain the inscription metadata."
                position="right"
                interactive={true}
              >
                <span className="font-medium cursor-help border-b border-dotted border-blue-400">The first input UTXO will hold your inscription</span>
              </Tooltip>
            </li>
            <li>
              <Tooltip
                content="Confirmed UTXOs are more reliable for inscriptions as unconfirmed ones might cause your transaction to fail if they get reorganized."
                position="right"
                interactive={true}
              >
                <span className="font-medium cursor-help border-b border-dotted border-blue-400">Prefer confirmed UTXOs</span>
              </Tooltip> (with at least 1 confirmation)
            </li>
            <li>
              <Tooltip
                content="This amount includes both the value required to create the inscription and the network fees for both commit and reveal transactions."
                position="right"
                interactive={true}
              >
                <span className="font-medium cursor-help border-b border-dotted border-blue-400">Total required funds</span>
              </Tooltip>: 
              {requiredAmount > 0 
                ? <span className="font-medium"> {formatBtcValue(requiredAmount)} BTC</span>
                : ' will be calculated based on your content'
              }
            </li>
            <li>
              <Tooltip
                content="Using a 'clean' UTXO without any inscription history can help avoid issues with inscription inheritance or mixed provenance."
                position="right"
                interactive={true}
              >
                <span className="font-medium cursor-help border-b border-dotted border-blue-400">Use "clean" UTXOs</span>
              </Tooltip> without prior inscription history if possible
            </li>
          </ul>
          <p className="text-xs italic">Hover over highlighted terms for more information</p>
        </div>
      )}

      {/* Error message */}
      {utxoError && (
        <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/10 p-3 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error loading UTXOs:</p>
            <p>{utxoError}</p>
            <button
              type="button"
              onClick={onFetchUtxos}
              className="text-red-700 dark:text-red-300 underline mt-1 text-sm hover:text-red-800 dark:hover:text-red-200"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* UTXO fetch button (when no UTXOs are loaded) */}
      {utxos.length === 0 && !isFetchingUtxos && flowState !== 'fetchingUtxos' && (
        <button
          type="button"
          onClick={onFetchUtxos}
          disabled={isFetchingUtxos || (flowState !== 'idle' && flowState !== 'awaitingUtxoSelection' && flowState !== 'failed')}
          className="w-full inline-flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isFetchingUtxos ? (
            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
          ) : (
            <Wallet className="-ml-1 mr-2 h-5 w-5" />
          )}
          Load Available UTXOs
        </button>
      )}

      {/* Loading indicator */}
      {isFetchingUtxos && (
        <div className="flex items-center justify-center p-8 text-gray-500 dark:text-gray-400">
          <Loader2 className="animate-spin mr-3 h-6 w-6" />
          <span>Loading your available UTXOs...</span>
        </div>
      )}

      {/* UTXO list with controls */}
      {utxos.length > 0 && !isFetchingUtxos && (
        <>
          {/* Controls for sorting and filtering */}
          <div className="flex flex-wrap gap-2 mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded-md">
            {/* Refresh button */}
            <button
              type="button"
              onClick={onFetchUtxos}
              disabled={isFetchingUtxos || (flowState !== 'idle' && flowState !== 'awaitingUtxoSelection' && flowState !== 'failed')}
              className="inline-flex items-center px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </button>
            
            {/* Filter controls */}
            <div className="inline-flex items-center rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 text-xs border-r border-gray-300 dark:border-gray-600">
                Filter:
              </span>
              <button
                type="button"
                onClick={() => setFilterOption('all')}
                className={`inline-flex items-center px-2 py-1 text-xs ${
                  filterOption === 'all' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterOption('recommended')}
                className={`inline-flex items-center px-2 py-1 text-xs ${
                  filterOption === 'recommended' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Recommended
              </button>
              <button
                type="button"
                onClick={() => setFilterOption('confirmed')}
                className={`inline-flex items-center px-2 py-1 text-xs ${
                  filterOption === 'confirmed' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Confirmed
              </button>
            </div>
            
            {/* Sort controls */}
            <div className="inline-flex items-center rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
              <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 text-xs border-r border-gray-300 dark:border-gray-600">
                Sort:
              </span>
              <button
                type="button"
                onClick={() => handleSortChange('value')}
                className={`inline-flex items-center px-2 py-1 text-xs ${
                  sortField === 'value' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Value
                {sortField === 'value' && (
                  sortDirection === 'desc' ? <SortDesc className="h-3 w-3 ml-1" /> : <SortAsc className="h-3 w-3 ml-1" />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleSortChange('age')}
                className={`inline-flex items-center px-2 py-1 text-xs ${
                  sortField === 'age' 
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' 
                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                Age
                {sortField === 'age' && (
                  sortDirection === 'desc' ? <SortDesc className="h-3 w-3 ml-1" /> : <SortAsc className="h-3 w-3 ml-1" />
                )}
              </button>
            </div>
          </div>
          
          {/* Selection summary */}
          <div className="mb-3 p-2 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Selected: </span>
              {selectedUtxos.length === 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  No UTXOs selected
                </span>
              ) : (
                <>
                  <span className="text-green-600 dark:text-green-400">
                    {selectedUtxos.length} UTXO{selectedUtxos.length !== 1 ? 's' : ''}
                  </span>
                  <span> with total value </span>
                  <span className="font-medium">
                    {formatBtcValue(totalSelectedValue)} BTC
                  </span>
                </>
              )}
            </p>
            
            {requiredAmount > 0 && (
              <div className="mt-1 text-sm">
                <span className="text-gray-700 dark:text-gray-300">Required: </span>
                <span className={`font-medium ${
                  totalSelectedValue >= requiredAmount
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatBtcValue(requiredAmount)} BTC
                </span>
                {totalSelectedValue < requiredAmount && (
                  <span className="text-red-600 dark:text-red-400 ml-2">
                    (insufficient funds)
                  </span>
                )}
              </div>
            )}
          </div>
          
          {/* UTXO list */}
          <div className="overflow-hidden border border-gray-200 dark:border-gray-700 rounded-md">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Select
                  </th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <Tooltip content="The unique identifier of this UTXO (transaction ID and output index)" position="top">
                      <span className="cursor-help border-b border-dotted border-gray-400">UTXO ID</span>
                    </Tooltip>
                  </th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <Tooltip content="The amount of bitcoin contained in this UTXO" position="top">
                      <span className="cursor-help border-b border-dotted border-gray-400">Value</span>
                    </Tooltip>
                  </th>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <Tooltip content="Whether this UTXO has been confirmed in a block" position="top">
                      <span className="cursor-help border-b border-dotted border-gray-400">Status</span>
                    </Tooltip>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                {processedUtxos.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                      No UTXOs available with current filter
                    </td>
                  </tr>
                ) : (
                  processedUtxos.map((utxo) => {
                    const isSelected = selectedUtxos.some(
                      selected => selected.txid === utxo.txid && selected.vout === utxo.vout
                    );
                    const isRecommended = isRecommendedUtxo(utxo);
                    
                    return (
                      <tr 
                        key={`${utxo.txid}-${utxo.vout}`}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          isSelected ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onUtxoSelectionChange(utxo, e.target.checked)}
                            disabled={flowState !== 'awaitingUtxoSelection'}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {getUtxoDisplayId(utxo)}
                          {isSelected && selectedUtxos[0].txid === utxo.txid && selectedUtxos[0].vout === utxo.vout && (
                            <Tooltip content="This UTXO will hold your inscription." position="right">
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                Primary
                              </span>
                            </Tooltip>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          <span className="font-medium">{formatBtcValue(utxo.value)}</span> BTC
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {utxo.status?.confirmed ? (
                            <span className="inline-flex items-center text-green-700 dark:text-green-400">
                              <Check className="h-4 w-4 mr-1" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-amber-600 dark:text-amber-400">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Unconfirmed
                            </span>
                          )}
                          {isRecommended && (
                            <Tooltip content="This UTXO meets the recommended criteria for inscriptions." position="left">
                              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                Recommended
                              </span>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default UtxoSelector; 