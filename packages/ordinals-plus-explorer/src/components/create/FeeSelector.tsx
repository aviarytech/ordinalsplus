import React from 'react';
import { FeeRates } from '../../hooks/useFeeRates';

/**
 * Props for FeeSelector component.
 */
export interface FeeSelectorProps {
  feeRates: FeeRates | null;
  loadingFees: boolean;
  feeError: string | null;
  selectedFeeLevel: 'hour' | 'halfHour' | 'fastest';
  manualFeeRate: string;
  useManualFee: boolean;
  flowState: string;
  onFeeLevelSelect: (level: 'hour' | 'halfHour' | 'fastest') => void;
  onManualFeeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRefreshFees: () => void;
}

/**
 * FeeSelector handles fee level selection, manual fee input, and fee refresh for resource creation.
 */
const FeeSelector: React.FC<FeeSelectorProps> = ({
  feeRates,
  loadingFees,
  feeError,
  manualFeeRate,
  useManualFee,
  selectedFeeLevel,
  flowState,
  onFeeLevelSelect,
  onManualFeeChange,
  onRefreshFees,
}) => {
  const formatFee = (fee: number | undefined) => (fee !== undefined ? fee.toFixed(1) : 'N/A');
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Fee Rate (sats/vB)</label>
      {loadingFees && <p className="text-sm text-gray-500 dark:text-gray-400">Loading fee estimates...</p>}
      {feeError && <p className="text-sm text-red-600 dark:text-red-400">Error loading fees: {feeError}</p>}
      {!loadingFees && feeRates && (
        <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 mb-2">
          {(['fastest', 'halfHour', 'hour'] as const).map(level => (
            <button
              key={level}
              type="button"
              onClick={() => onFeeLevelSelect(level)}
              disabled={flowState !== 'idle' && flowState !== 'awaitingUtxoSelection'}
              className={`flex-1 px-3 py-2 border rounded-md text-sm focus:outline-none transition-colors duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed
                ${!useManualFee && selectedFeeLevel === level
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
            >
              <span className="font-medium capitalize">{level === 'halfHour' ? '30 Min' : level === 'fastest' ? 'Fastest' : '1 Hour'}</span>
              <br />
              <span className="text-xs">({
                level === 'fastest'
                  ? formatFee(feeRates.fastestFee)
                  : level === 'halfHour'
                  ? formatFee(feeRates.halfHourFee)
                  : formatFee(feeRates.hourFee)
              } sats/vB)</span>
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center space-x-2">
        <input
          type="text"
          pattern="\\d*"
          placeholder="Manual sats/vB"
          value={manualFeeRate}
          onChange={onManualFeeChange}
          disabled={flowState !== 'idle' && flowState !== 'awaitingUtxoSelection'}
          className={`flex-grow p-2 border rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50
            ${useManualFee ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-300 dark:border-gray-600'}
          `}
        />
        <button
          type="button"
          onClick={onRefreshFees}
          disabled={loadingFees || (flowState !== 'idle' && flowState !== 'awaitingUtxoSelection')}
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          title="Refresh fee estimates"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-5 h-5 ${loadingFees ? 'animate-spin' : ''}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FeeSelector; 