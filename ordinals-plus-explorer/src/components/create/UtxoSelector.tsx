import React from 'react';
import { Utxo } from '../../context/WalletContext';
import { Loader2, Wallet, AlertCircle } from 'lucide-react';
import { truncateMiddle } from '../../utils/string';

/**
 * Props for UtxoSelector component.
 */
export interface UtxoSelectorProps {
  walletConnected: boolean;
  utxos: Utxo[];
  selectedUtxos: Utxo[];
  isFetchingUtxos: boolean;
  utxoError: string | null;
  flowState: string;
  onFetchUtxos: () => void;
  onUtxoSelectionChange: (utxo: Utxo, isSelected: boolean) => void;
}

/**
 * UtxoSelector handles fetching and selecting UTXOs for resource creation.
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
}) => {
  if (!walletConnected) return null;
  return (
    <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md">
      <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200">Select Funding UTXOs</h3>
      {utxoError && (
        <div className="text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="inline-block mr-1 h-4 w-4" /> {utxoError}
        </div>
      )}
      {utxos.length === 0 && !isFetchingUtxos && flowState !== 'fetchingUtxos' && (
        <button
          type="button"
          onClick={onFetchUtxos}
          disabled={isFetchingUtxos || (flowState !== 'idle' && flowState !== 'awaitingUtxoSelection' && flowState !== 'failed')}
          className="w-full inline-flex justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isFetchingUtxos ? (
            <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
          ) : (
            <Wallet className="-ml-1 mr-2 h-5 w-5" />
          )}
          Load Available UTXOs
        </button>
      )}
      {isFetchingUtxos && (
        <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          Fetching UTXOs...
        </div>
      )}
      {utxos.length > 0 && !isFetchingUtxos && (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {[...utxos]
            .sort((a, b) => b.value - a.value)
            .map((utxo) => {
              const isChecked = selectedUtxos.some(u => u.txid === utxo.txid && u.vout === utxo.vout);
              return (
                <label
                  key={`${utxo.txid}:${utxo.vout}`}
                  className={`flex items-center p-3 rounded-md border cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onUtxoSelectionChange(utxo, e.target.checked)}
                    disabled={flowState !== 'idle' && flowState !== 'awaitingUtxoSelection'}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
                  />
                  <div className="flex-grow text-sm">
                    <span className="font-mono block text-gray-700 dark:text-gray-300" title={`${utxo.txid}:${utxo.vout}`}>
                      {truncateMiddle(utxo.txid, 10)}:{utxo.vout}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {(utxo.value / 100_000_000).toFixed(8)} BTC
                    </span>
                  </div>
                </label>
              );
            })}
        </div>
      )}
    </div>
  );
};

export default UtxoSelector; 