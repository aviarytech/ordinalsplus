import type { InscriptionResponse } from '../types';
import type { Inscription } from 'ordinalsplus';
import { OrdiscanProvider } from 'ordinalsplus';
import { env } from '../config/envConfig';

const ORDISCAN_API_KEY = env.ORDISCAN_API_KEY;
let provider: OrdiscanProvider;

// Local options type definition might be slightly different from the actual one,
// but the constructor requires apiKey to be a string.
interface OrdiscanProviderOptions {
    apiKey: string; // Changed to required string
}

// Function to get or initialize the provider
function getProvider(): OrdiscanProvider {
  if (!provider) {
    // Ensure API key is provided before initializing
    if (!ORDISCAN_API_KEY) {
        console.error('CRITICAL: ORDISCAN_API_KEY environment variable is not set. Cannot initialize OrdiscanProvider.');
        throw new Error('Ordiscan API Key is missing. Please set the ORDISCAN_API_KEY environment variable.');
    }

    const options: OrdiscanProviderOptions = { apiKey: ORDISCAN_API_KEY };
    try {
        provider = new OrdiscanProvider(options);
        console.log('OrdiscanProvider initialized successfully.');
    } catch (initError) {
        console.error('Failed to initialize OrdiscanProvider:', initError);
        // Re-throw or handle initialization error appropriately
        throw new Error(`Failed to initialize OrdiscanProvider: ${initError instanceof Error ? initError.message : String(initError)}`);
    }
  }
  
  return provider;
}

/**
 * Fetch inscriptions from the ordinals provider
 * NOTE: Method 'fetchInscriptions' does not seem to exist on OrdiscanProvider.
 * Commenting out until the correct method is identified.
 */
/*
export const fetchInscriptions = async (
  offset = 0,
  limit = 300
): Promise<InscriptionResponse> => {
  try {
    const provider = getProvider();
    // return await provider.fetchInscriptions(offset, limit); // Original call
    throw new Error('fetchInscriptions method not implemented on OrdiscanProvider');
  } catch (error) {
    console.error('Error fetching inscriptions:', error);
    throw error;
  }
};
*/

/**
 * Fetch a specific inscription by ID
 * Renamed from fetchInscriptionById to getInscription based on linter suggestion.
 */
export const getInscription = async (inscriptionId: string): Promise<Inscription> => {
  try {
    const provider = getProvider();
    const result = await provider.getInscription(inscriptionId); // Use suggested method name
    
    if (!result) {
      throw new Error(`Inscription with ID ${inscriptionId} not found`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching inscription with ID ${inscriptionId}:`, error);
    throw error;
  }
};

/**
 * Search inscriptions based on content
 * NOTE: Method 'searchInscriptionsByContent' does not seem to exist on OrdiscanProvider.
 * Commenting out until the correct method is identified.
 */
/*
export const searchInscriptionsByContent = async (
  searchQuery: string,
  offset = 0,
  limit = 300
): Promise<InscriptionResponse> => {
  try {
    const provider = getProvider();
    // return await provider.searchInscriptionsByContent(searchQuery, offset, limit); // Original call
    throw new Error('searchInscriptionsByContent method not implemented on OrdiscanProvider');
  } catch (error) {
    console.error('Error searching inscriptions:', error);
    throw error;
  }
};
*/

/**
 * Fetch the content for an inscription
 * NOTE: Method 'fetchInscriptionContent' does not seem to exist on OrdiscanProvider.
 * Content might be part of the getInscription response.
 * Commenting out until the correct method is identified.
 */
/*
export const fetchInscriptionContent = async (
  inscriptionId: string,
  contentType: string
): Promise<any> => {
  try {
    const provider = getProvider();
    // return await provider.fetchInscriptionContent(inscriptionId, contentType); // Original call
     throw new Error('fetchInscriptionContent method not implemented on OrdiscanProvider');
  } catch (error) {
    console.error(`Error fetching content for inscription ${inscriptionId}:`, error);
    throw error;
  }
};
*/

/**
 * Fetch an inscription by its sat number
 * NOTE: Method 'fetchInscriptionBySat' does not seem to exist on OrdiscanProvider.
 * Commenting out until the correct method is identified.
 */
/*
export const fetchInscriptionBySat = async (sat: number): Promise<Inscription> => {
  try {
    const provider = getProvider();
    // const result = await provider.fetchInscriptionBySat(sat); // Original call
    throw new Error('fetchInscriptionBySat method not implemented on OrdiscanProvider');
    
    // if (!result) {
    //   throw new Error(`Inscription with sat ${sat} not found`);
    // }
    // return result;
  } catch (error) {
    console.error(`Error fetching inscription with sat ${sat}:`, error);
    throw error;
  }
};
*/ 