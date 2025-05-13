import { Inscription, InscriptionResponse } from '../types';

const ORDISCAN_API_BASE_URL = 'https://ordiscan.org/api/v1';

export const fetchInscriptions = async (
  offset = 0,
  limit = 100,
  contentType?: string
): Promise<InscriptionResponse> => {
  try {
    let url = `${ORDISCAN_API_BASE_URL}/inscriptions?offset=${offset}&limit=${limit}`;
    
    if (contentType) {
      url += `&content_type=${encodeURIComponent(contentType)}`;
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data as InscriptionResponse;
  } catch (error) {
    console.error('Error fetching inscriptions:', error);
    throw error;
  }
};

export const fetchInscriptionById = async (inscriptionId: string): Promise<Inscription> => {
  try {
    const url = `${ORDISCAN_API_BASE_URL}/inscription/${inscriptionId}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data as Inscription;
  } catch (error) {
    console.error(`Error fetching inscription with ID ${inscriptionId}:`, error);
    throw error;
  }
};

export const searchInscriptionsByContent = async (
  searchQuery: string,
  offset = 0,
  limit = 100
): Promise<InscriptionResponse> => {
  try {
    const url = `${ORDISCAN_API_BASE_URL}/inscriptions/search?q=${encodeURIComponent(searchQuery)}&offset=${offset}&limit=${limit}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    return data as InscriptionResponse;
  } catch (error) {
    console.error('Error searching inscriptions:', error);
    throw error;
  }
};
