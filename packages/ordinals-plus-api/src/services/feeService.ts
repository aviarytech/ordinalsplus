// Service for fetching fee estimations
import fetchClient from '../utils/fetchUtils';
import type { FeeEstimateResponse, NetworkType } from '../types';

// Mempool.space API base URLs
const MEMPOOL_MAINNET_API_URL = 'https://mempool.space/api';
const MEMPOOL_SIGNET_API_URL = 'https://mempool.space/signet/api';

// Helper to get the correct API URL based on network
const getMempoolApiUrl = (network: NetworkType): string => {
    switch (network) {
        case 'signet':
            return MEMPOOL_SIGNET_API_URL;
        case 'mainnet':
        default:
            return MEMPOOL_MAINNET_API_URL;
    }
};

/**
 * Fetches recommended fee rates from mempool.space API for the specified network.
 * @param {NetworkType} network - The network ('mainnet' or 'signet') to fetch fees for. Defaults to 'mainnet'.
 * @returns {Promise<FeeEstimateResponse>} Object containing low, medium, and high fee rates.
 */
export async function getFeeEstimates(network: NetworkType = 'mainnet'): Promise<FeeEstimateResponse> {
    const apiUrl = getMempoolApiUrl(network);
    console.log(`Fetching fee estimates from ${apiUrl} for ${network}...`);
    try {
        const response = await fetchClient.get(`${apiUrl}/v1/fees/recommended`);
        const data = response.data;

        // Ensure the API response has the expected format
        if (typeof data.fastestFee !== 'number' || 
            typeof data.halfHourFee !== 'number' || 
            typeof data.hourFee !== 'number') {
            throw new Error(`Invalid fee estimate response format from ${apiUrl}`);
        }

        // Map mempool.space fees to our response structure
        // Using hourFee for low, halfHourFee for medium, fastestFee for high
        const estimates: FeeEstimateResponse = {
            low: Math.max(1, Math.round(data.hourFee)),       // Ensure minimum 1 sat/vB
            medium: Math.max(1, Math.round(data.halfHourFee)),
            high: Math.max(1, Math.round(data.fastestFee)),
        };

        console.log(`Fee estimates fetched for ${network}:`, estimates);
        return estimates;
    } catch (error) {
        console.error(`Error fetching fee estimates from ${apiUrl} for ${network}:`, error);
        // Provide fallback or throw a more specific error
        throw new Error(`Failed to fetch fee estimates for ${network}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
} 