import { useState, useEffect } from 'react';
import { useNetwork } from '../context/NetworkContext';

export interface FeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  minimumFee?: number; // Optional, might not always be present
}

interface UseFeeRatesResult {
  feeRates: FeeRates | null;
  loading: boolean;
  error: string | null;
  refreshFees: () => void;
}

const MEMPOOL_SPACE_URL_MAINNET = 'https://mempool.space/api/v1/fees/recommended';
const MEMPOOL_SPACE_URL_TESTNET = 'https://mempool.space/testnet/api/v1/fees/recommended';

/**
 * Hook to fetch recommended Bitcoin transaction fee rates from Mempool.space API.
 * Automatically selects the correct endpoint based on the active network context.
 */
export const useFeeRates = (): UseFeeRatesResult => {
  const [feeRates, setFeeRates] = useState<FeeRates | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0); // State to trigger refresh
  
  const { network: activeNetwork } = useNetwork(); // Get active network from context

  const refreshFees = () => {
    setRefreshTrigger(prev => prev + 1); // Increment trigger to re-run effect
  };

  useEffect(() => {
    const fetchFeeRates = async () => {
      if (!activeNetwork) {
          setError('No active network selected.');
          setFeeRates(null);
          return;
      }
      
      setLoading(true);
      setError(null);
      setFeeRates(null); // Clear previous rates

      // Determine API URL based on active network type
      const apiUrl = activeNetwork.type === 'testnet' 
                       ? MEMPOOL_SPACE_URL_TESTNET 
                       : MEMPOOL_SPACE_URL_MAINNET;
                       
      // Note: Mempool.space doesn't have a regtest endpoint
      if (activeNetwork.type === 'regtest') {
           console.warn('[useFeeRates] Regtest network detected. Using mock fee rates as Mempool.space has no regtest API.');
           // Provide mock/default fees for regtest
           setFeeRates({ fastestFee: 1, halfHourFee: 1, hourFee: 1, minimumFee: 1 });
           setLoading(false);
           return;
      }

      console.log(`[useFeeRates] Fetching fees for ${activeNetwork.type} from ${apiUrl}`);

      try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch fee rates: ${response.status} ${response.statusText}`);
        }
        const data: FeeRates = await response.json();
        setFeeRates(data);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching fee rates';
        console.error('[useFeeRates] Error:', errorMsg);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchFeeRates();
    
    // Re-fetch when activeNetwork changes or refresh is triggered
  }, [activeNetwork, refreshTrigger]); 

  return { feeRates, loading, error, refreshFees };
}; 