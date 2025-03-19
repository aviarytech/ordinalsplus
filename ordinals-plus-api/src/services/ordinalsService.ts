import type { Inscription, InscriptionResponse } from '../types';

const ORDISCAN_API_BASE_URL = 'https://api.ordiscan.com/v1';
const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY;

if (!ORDISCAN_API_KEY) {
  console.warn('ORDISCAN_API_KEY environment variable is not set. API requests will likely fail.');
}

// Common headers to include in all requests
const getHeaders = () => ({
  'Authorization': `Bearer ${ORDISCAN_API_KEY}`,
  'Content-Type': 'application/json'
});

/**
 * Maps the Ordiscan API response to our Inscription type
 */
function mapOrdiscanInscription(ordiscanInscription: any): Inscription {
  // Ensure the inscription ID is present
  if (!ordiscanInscription.inscription_id) {
    console.warn('Ordiscan inscription is missing ID', ordiscanInscription);
  }
  
  return {
    id: ordiscanInscription.inscription_id || '',
    number: ordiscanInscription.inscription_number || 0,
    address: ordiscanInscription.owner_address || '',
    content_type: ordiscanInscription.content_type || 'text/plain',
    content: '',  // Ordiscan API doesn't return content directly
    content_length: 0,
    timestamp: ordiscanInscription.timestamp || '',
    genesis_transaction: ordiscanInscription.genesis_transaction || '',
    output_value: 0,
    offset: 0,
    location: ordiscanInscription.location || '',
    genesis_fee: 0,
    // Add sat data
    sat: ordiscanInscription.sat || 0,
    sat_ordinal: ordiscanInscription.sat_ordinal || '',
    // Add content URL
    content_url: ordiscanInscription.content_url || '',
    // Extra metadata for debugging
    metadata: ordiscanInscription.metadata || null
  };
}

/**
 * Fetch inscriptions from the Ordiscan API
 * Gets the most recent inscriptions
 */
export const fetchInscriptions = async (
  offset = 0,
  limit = 300 // Increased limit to get more inscriptions
): Promise<InscriptionResponse> => {
  try {
    // Build query parameters
    const params = new URLSearchParams();
    if (offset > 0) {
      params.append('after', offset.toString());
    }
    params.append('limit', limit.toString());
    
    let url = `${ORDISCAN_API_BASE_URL}/inscriptions?${params.toString()}`;
    
    console.log(`Fetching inscriptions from: ${url}`);
    
    const response = await fetch(url, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
    }
    
    const responseData = await response.json() as { data?: any[] };
    console.log('Response data structure:', Object.keys(responseData));
    
    // Check if the response has a 'data' property that contains the actual results
    const ordiscanInscriptions = responseData.data || [];
    
    // Log a sample inscription to see its structure
    if (ordiscanInscriptions.length > 0) {
      console.log('Sample inscription:', JSON.stringify(ordiscanInscriptions[0], null, 2));
    }
    
    // Map the Ordiscan inscriptions to our Inscription type
    const inscriptions = Array.isArray(ordiscanInscriptions) 
      ? ordiscanInscriptions.map(mapOrdiscanInscription)
      : [];
    
    console.log(`Mapped ${inscriptions.length} inscriptions with IDs:`, 
      inscriptions.slice(0, 3).map(i => i.id));
    
    // Adjust for the shape of the returned data
    return {
      limit,
      offset,
      total: inscriptions.length,
      results: inscriptions
    };
  } catch (error) {
    console.error('Error fetching inscriptions:', error);
    throw error;
  }
};

export const fetchInscriptionById = async (inscriptionId: string): Promise<Inscription> => {
  try {
    const url = `${ORDISCAN_API_BASE_URL}/inscription/${inscriptionId}`;
    
    console.log(`Fetching inscription by ID from: ${url}`);
    
    const response = await fetch(url, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
    }
    
    const responseData = await response.json() as { data?: any };
    
    // Extract the inscription data from the 'data' property if present
    const ordiscanInscription = responseData.data || responseData;
    
    // Map to our Inscription type
    return mapOrdiscanInscription(ordiscanInscription);
  } catch (error) {
    console.error(`Error fetching inscription with ID ${inscriptionId}:`, error);
    throw error;
  }
};

/**
 * This function now simply fetches all inscriptions
 * The searchQuery parameter is kept for compatibility but not used for filtering
 */
export const searchInscriptionsByContent = async (
  searchQuery: string,
  offset = 0,
  limit = 300 // Increased limit to get more inscriptions
): Promise<InscriptionResponse> => {
  try {
    console.log(`Fetching all inscriptions, ignoring search query "${searchQuery}"`);
    
    // Simply fetch all inscriptions without filtering
    return fetchInscriptions(offset, limit);
  } catch (error) {
    console.error('Error fetching inscriptions:', error);
    throw error;
  }
}; 