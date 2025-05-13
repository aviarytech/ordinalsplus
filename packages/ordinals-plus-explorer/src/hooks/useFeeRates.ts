import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '../context/WalletContext';
import { useApi } from '../context/ApiContext';
import { FeeEstimateResponse } from '../types/index';

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

/**
 * Hook to fetch recommended Bitcoin transaction fee rates via the backend API service.
 * Automatically uses the active network context.
 */
export const useFeeRates = (): UseFeeRatesResult => {
  const [feeRates, setFeeRates] = useState<FeeRates | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  
  const { network: activeNetwork } = useWallet();
  const { apiService } = useApi();

  const refreshFees = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  useEffect(() => {
    const fetchFeeRates = async () => {
      if (!activeNetwork) {
        setError('Wallet not connected or network not determined.');
        setFeeRates(null);
        setLoading(false);
        return;
      }
      if (!apiService) {
        setError('API service not available.');
        setFeeRates(null);
        setLoading(false);
        return;
      }
      
      setLoading(true);
      setError(null);
      setFeeRates(null);

      console.log(`[useFeeRates] Fetching fees for ${activeNetwork} via ApiService`);

      try {
        const response: FeeEstimateResponse = await apiService.getFeeEstimates(activeNetwork);
        
        if (response && typeof response.high === 'number' && typeof response.medium === 'number' && typeof response.low === 'number') {
          setFeeRates({
            fastestFee: response.high,
            halfHourFee: response.medium,
            hourFee: response.low,
          });
        } else {
            throw new Error('Invalid fee rate data received from API (missing low/medium/high)');
        }
        
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error fetching fee rates';
        console.error('[useFeeRates] Error:', errorMsg);
        setError(errorMsg);
      } finally {
        setLoading(false);
      }
    };

    fetchFeeRates();
    
  }, [activeNetwork, apiService, refreshTrigger]);

  return { feeRates, loading, error, refreshFees };
}; 