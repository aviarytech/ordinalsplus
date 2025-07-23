import React, { useState, useEffect } from 'react';
import { 
  estimateInscriptionFees, 
  formatFee, 
  getSelectedFeeRate, 
  FeeRateLevel 
} from '../../utils/fees';
import { useFeeRates } from '../../hooks/useFeeRates';
import { Tooltip } from '../ui';
import { Info, RefreshCw } from 'lucide-react';

/**
 * Props for the FeeEstimator component
 */
interface FeeEstimatorProps {
  inscriptionSizeBytes: number;
  utxoCount?: number;
  addressType?: 'p2wpkh' | 'p2pkh' | 'p2sh' | 'p2tr';
  includeChange?: boolean;
  className?: string;
  onFeeCalculated?: (fees: {
    commitFee: number;
    revealFee: number;
    totalFee: number;
    minimumRequiredAmount: number;
    commitTxSize: number;
    revealTxSize: number;
    feeRate: number;
  } | null) => void;
}

/**
 * FeeEstimator component displays real-time fee estimations for ordinal inscriptions
 * based on current fee rates and inscription parameters.
 */
const FeeEstimator: React.FC<FeeEstimatorProps> = ({ 
  inscriptionSizeBytes,
  utxoCount = 1,
  addressType = 'p2wpkh',
  includeChange = true,
  className = '',
  onFeeCalculated
}) => {
  // State for fee selection
  const [selectedLevel, setSelectedLevel] = useState<FeeRateLevel>(FeeRateLevel.MEDIUM);
  const [manualFeeRate, setManualFeeRate] = useState<string>('');
  const [useManualFee, setUseManualFee] = useState<boolean>(false);
  
  // Get fee rates from API
  const { feeRates, loading: loadingFees, error: feeError, refreshFees } = useFeeRates();
  
  // State for calculated fees
  const [feeEstimate, setFeeEstimate] = useState<{
    commitTxSize: number;
    revealTxSize: number;
    commitFee: number;
    revealFee: number;
    totalFee: number;
    minimumRequiredAmount: number;
  } | null>(null);
  
  // Calculate the current fee rate based on selection
  const currentFeeRate = getSelectedFeeRate(
    feeRates,
    selectedLevel,
    useManualFee ? manualFeeRate : undefined
  );
  
  // Update fee estimates when parameters change
  useEffect(() => {
    if (currentFeeRate === null || inscriptionSizeBytes <= 0) {
      setFeeEstimate(null);
      if (onFeeCalculated) onFeeCalculated(null);
      return;
    }
    
    const calculatedFees = estimateInscriptionFees(
      inscriptionSizeBytes,
      utxoCount,
      currentFeeRate,
      includeChange,
      addressType
    );
    
    setFeeEstimate(calculatedFees);
    
    // Notify parent component if callback is provided
    if (onFeeCalculated && calculatedFees) {
      onFeeCalculated({
        commitFee: calculatedFees.commitFee,
        revealFee: calculatedFees.revealFee,
        totalFee: calculatedFees.totalFee,
        minimumRequiredAmount: calculatedFees.minimumRequiredAmount,
        commitTxSize: calculatedFees.commitTxSize,
        revealTxSize: calculatedFees.revealTxSize,
        feeRate: currentFeeRate
      });
    }
  }, [inscriptionSizeBytes, utxoCount, addressType, includeChange, currentFeeRate, onFeeCalculated]);
  
  // Handle fee level selection
  const handleFeeSelection = (level: FeeRateLevel) => {
    setSelectedLevel(level);
    setUseManualFee(false);
  };
  
  // Handle manual fee rate input
  const handleManualFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow only numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setManualFeeRate(value);
      setUseManualFee(true);
    }
  };
  
  // Format fee rate display
  const formatFeeRate = (rate: number | undefined) => {
    return rate !== undefined ? rate.toFixed(1) : 'N/A';
  };
  
  return (
    <div className={`fee-estimator ${className}`}>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          <Tooltip
            content={
              <div>
                <p>The fee rate determines how quickly your transactions will be confirmed by miners.</p>
                <p className="mt-1">Higher fee rates result in faster confirmations but increase the total cost.</p>
                <p className="mt-1">Measured in satoshis per virtual byte (sats/vB).</p>
              </div>
            }
            position="top"
            showIcon={true}
          >
            Transaction Fee Rate (sats/vB)
          </Tooltip>
        </label>
        
        {/* Fee rate selector buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {/* Low fee button */}
          <Tooltip
            content="Lowest cost option. Transactions might take several hours to confirm."
            position="top"
          >
            <button
              type="button"
              onClick={() => handleFeeSelection(FeeRateLevel.LOW)}
              className={`px-3 py-2 flex-1 border rounded-md text-sm transition-colors
                ${!useManualFee && selectedLevel === FeeRateLevel.LOW
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
            >
              <span className="font-medium">Low</span>
              <br />
              <span className="text-xs">({formatFeeRate(feeRates?.hourFee)} sats/vB)</span>
            </button>
          </Tooltip>
          
          {/* Medium fee button */}
          <Tooltip
            content="Balanced option. Transactions usually confirm within an hour."
            position="top"
          >
            <button
              type="button"
              onClick={() => handleFeeSelection(FeeRateLevel.MEDIUM)}
              className={`px-3 py-2 flex-1 border rounded-md text-sm transition-colors
                ${!useManualFee && selectedLevel === FeeRateLevel.MEDIUM
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
            >
              <span className="font-medium">Medium</span>
              <br />
              <span className="text-xs">({formatFeeRate(feeRates?.halfHourFee)} sats/vB)</span>
            </button>
          </Tooltip>
          
          {/* High fee button */}
          <Tooltip
            content="Fastest option. Transactions typically confirm within minutes."
            position="top"
          >
            <button
              type="button"
              onClick={() => handleFeeSelection(FeeRateLevel.HIGH)}
              className={`px-3 py-2 flex-1 border rounded-md text-sm transition-colors
                ${!useManualFee && selectedLevel === FeeRateLevel.HIGH
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                }`}
            >
              <span className="font-medium">High</span>
              <br />
              <span className="text-xs">({formatFeeRate(feeRates?.fastestFee)} sats/vB)</span>
            </button>
          </Tooltip>
        </div>
        
        {/* Manual fee input */}
        <div className="flex items-center gap-2">
          <Tooltip
            content="Set a custom fee rate if you want precise control over confirmation times and costs."
            position="top"
          >
            <input
              type="text"
              placeholder="Custom rate (sats/vB)"
              value={manualFeeRate}
              onChange={handleManualFeeChange}
              onFocus={() => setUseManualFee(true)}
              className={`flex-grow p-2 border rounded-md text-sm
                ${useManualFee 
                  ? 'border-indigo-500 ring-1 ring-indigo-500' 
                  : 'border-gray-300 dark:border-gray-600'
                } dark:bg-gray-800 dark:text-gray-100`}
            />
          </Tooltip>
          <Tooltip
            content="Get the latest fee rates from the Bitcoin network."
            position="top"
          >
            <button
              type="button"
              onClick={refreshFees}
              disabled={loadingFees}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              title="Refresh fee estimates"
            >
              <RefreshCw 
                className={`w-5 h-5 ${loadingFees ? 'animate-spin' : ''}`}
              />
            </button>
          </Tooltip>
        </div>
        
        {/* Loading and error states */}
        {loadingFees && <p className="text-sm text-gray-500 mt-2">Loading fee estimates...</p>}
        {feeError && <p className="text-sm text-red-500 mt-2">Error: {feeError}</p>}
        
        {/* Fee estimation display */}
        {feeEstimate && (
          <div className="mt-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800">
            <h3 className="text-md font-medium mb-2 flex items-center">
              <span>Fee Estimate</span>
              <Tooltip
                content={
                  <div>
                    <p>Ordinal inscriptions use a two-transaction process:</p>
                    <ol className="list-decimal list-inside mt-1 space-y-1">
                      <li>Commit Transaction: Sends funds to the inscription address</li>
                      <li>Reveal Transaction: Creates the actual inscription</li>
                    </ol>
                    <p className="mt-1">Both transactions require separate fees based on their size.</p>
                  </div>
                }
                position="right"
              >
                <Info className="ml-1 h-4 w-4 text-gray-400 cursor-help" />
              </Tooltip>
            </h3>
            
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-2">
                    <Tooltip content="The current fee rate that will be used for both transactions." position="right">
                      <span className="cursor-help border-b border-dotted border-gray-400">Fee Rate:</span>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-right font-medium">{currentFeeRate} sats/vB</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-2">
                    <Tooltip content="The first transaction that prepares for the inscription by sending funds to the inscription address." position="right">
                      <span className="cursor-help border-b border-dotted border-gray-400">Commit Transaction:</span>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-right">
                    <Tooltip content="Virtual bytes - the size of the transaction that affects fees." position="top">
                      <span className="text-xs text-gray-500 cursor-help border-b border-dotted border-gray-400">{feeEstimate.commitTxSize} vB</span>
                    </Tooltip>
                    {' • '}
                    <span className="font-medium">{formatFee(feeEstimate.commitFee)}</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-2">
                    <Tooltip content="The second transaction that creates the actual inscription on the Bitcoin blockchain." position="right">
                      <span className="cursor-help border-b border-dotted border-gray-400">Reveal Transaction:</span>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-right">
                    <Tooltip content="Virtual bytes - the size of the transaction that affects fees." position="top">
                      <span className="text-xs text-gray-500 cursor-help border-b border-dotted border-gray-400">{feeEstimate.revealTxSize} vB</span>
                    </Tooltip>
                    {' • '}
                    <span className="font-medium">{formatFee(feeEstimate.revealFee)}</span>
                  </td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-700 font-medium">
                  <td className="py-2">
                    <Tooltip content="The sum of both transaction fees." position="right">
                      <span className="cursor-help border-b border-dotted border-gray-400">Total Fee:</span>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-right">{formatFee(feeEstimate.totalFee)}</td>
                </tr>
                <tr className="font-medium text-indigo-600 dark:text-indigo-400">
                  <td className="py-2">
                    <Tooltip 
                      content="This is the minimum amount you need to have in your selected UTXO to complete the inscription process."
                      position="right"
                    >
                      <span className="cursor-help border-b border-dotted border-indigo-400">Minimum Required Amount:</span>
                    </Tooltip>
                  </td>
                  <td className="py-2 text-right">{formatFee(feeEstimate.minimumRequiredAmount)}</td>
                </tr>
              </tbody>
            </table>
            
            <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 italic">
              <p>These estimates are based on current network conditions and may vary.</p>
              <p>Larger inscriptions require more fees due to increased transaction size.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FeeEstimator; 