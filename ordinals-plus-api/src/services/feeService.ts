// Service for fetching fee estimations
import axios from 'axios';
import type { FeeEstimateResponse } from '../types';

// Use mempool.space API for fee estimates
// TODO: Make base URL and network configurable (e.g., for testnet)
const MEMPOOL_API_URL = 'https://mempool.space/api';

/**
 * Fetches recommended fee rates from mempool.space API.
 * @returns {Promise<FeeEstimateResponse>} Object containing low, medium, and high fee rates.
 */
export async function getFeeEstimates(): Promise<FeeEstimateResponse> {
    console.log('Fetching fee estimates from mempool.space...');
    try {
        const response = await axios.get(`${MEMPOOL_API_URL}/v1/fees/recommended`);
        const data = response.data;

        // Ensure the API response has the expected format
        if (typeof data.fastestFee !== 'number' || 
            typeof data.halfHourFee !== 'number' || 
            typeof data.hourFee !== 'number') {
            throw new Error('Invalid fee estimate response format from mempool.space');
        }

        // Map mempool.space fees to our response structure
        // Using hourFee for low, halfHourFee for medium, fastestFee for high
        const estimates: FeeEstimateResponse = {
            low: Math.max(1, Math.round(data.hourFee)),       // Ensure minimum 1 sat/vB
            medium: Math.max(1, Math.round(data.halfHourFee)),
            high: Math.max(1, Math.round(data.fastestFee)),
        };

        console.log('Fee estimates fetched:', estimates);
        return estimates;
    } catch (error) {
        console.error('Error fetching fee estimates from mempool.space:', error);
        // Provide fallback or throw a more specific error
        throw new Error(`Failed to fetch fee estimates: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
} 