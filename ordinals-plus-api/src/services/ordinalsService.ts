import type { InscriptionResponse } from '../types';
import type { Inscription } from 'ordinalsplus';
import OrdinalsPlus, { type IOrdinalsProvider, type OrdinalsProviderType } from 'ordinalsplus';

// Initialize the provider with the API key from environment variables
const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY;
let provider: IOrdinalsProvider;

// Function to get or initialize the provider
function getProvider(): IOrdinalsProvider {
  if (!provider) {
    // Initialize the provider with the API key
    provider = OrdinalsPlus.services.getOrdinalsProvider('ordiscan' as OrdinalsProviderType, ORDISCAN_API_KEY);
    
    if (!ORDISCAN_API_KEY) {
      console.warn('ORDISCAN_API_KEY environment variable is not set. API requests will likely fail.');
    }
  }
  
  return provider;
}

/**
 * Fetch inscriptions from the ordinals provider
 */
export const fetchInscriptions = async (
  offset = 0,
  limit = 300
): Promise<InscriptionResponse> => {
  try {
    // Get the provider and make the request
    const provider = getProvider();
    return await provider.fetchInscriptions(offset, limit);
  } catch (error) {
    console.error('Error fetching inscriptions:', error);
    throw error;
  }
};

/**
 * Fetch a specific inscription by ID
 */
export const fetchInscriptionById = async (inscriptionId: string): Promise<Inscription> => {
  try {
    // Get the provider and make the request
    const provider = getProvider();
    const result = await provider.fetchInscriptionById(inscriptionId);
    
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
 */
export const searchInscriptionsByContent = async (
  searchQuery: string,
  offset = 0,
  limit = 300
): Promise<InscriptionResponse> => {
  try {
    // Get the provider and make the request
    const provider = getProvider();
    return await provider.searchInscriptionsByContent(searchQuery, offset, limit);
  } catch (error) {
    console.error('Error searching inscriptions:', error);
    throw error;
  }
};

/**
 * Fetch the content for an inscription
 */
export const fetchInscriptionContent = async (
  inscriptionId: string,
  contentType: string
): Promise<any> => {
  try {
    // Get the provider and make the request
    const provider = getProvider();
    return await provider.fetchInscriptionContent(inscriptionId, contentType);
  } catch (error) {
    console.error(`Error fetching content for inscription ${inscriptionId}:`, error);
    throw error;
  }
};

/**
 * Fetch an inscription by its sat number
 */
export const fetchInscriptionBySat = async (sat: number): Promise<Inscription> => {
  try {
    // Get the provider and make the request
    const provider = getProvider();
    const result = await provider.fetchInscriptionBySat(sat);
    
    if (!result) {
      throw new Error(`Inscription with sat ${sat} not found`);
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching inscription with sat ${sat}:`, error);
    throw error;
  }
}; 