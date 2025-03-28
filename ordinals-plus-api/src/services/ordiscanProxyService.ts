/**
 * Ordiscan API Proxy Service
 * 
 * This service provides functions to proxy requests to the Ordiscan API
 * while keeping the API key secure on the server side.
 */

const ORDISCAN_API_URL = 'https://api.ordiscan.com/v1';
const ORDISCAN_API_KEY = process.env.ORDISCAN_API_KEY;

/**
 * Check if the Ordiscan API is available
 */
export async function getOrdiscanStatus() {
  if (!ORDISCAN_API_KEY) {
    return { 
      error: 'Ordiscan API key not configured on server', 
      status: 'unavailable',
      code: 500 
    };
  }
  
  try {
    // Test the API by fetching a small amount of inscriptions
    const response = await fetch(`${ORDISCAN_API_URL}/inscriptions?limit=1`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${ORDISCAN_API_KEY}`
      }
    });
    
    return { 
      status: response.ok ? 'available' : 'unavailable',
      code: response.status,
      message: response.ok ? 'Ordiscan API is available' : `Ordiscan API returned status ${response.status}`
    };
  } catch (error) {
    console.error('Error checking Ordiscan status:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 'unavailable',
      code: 500 
    };
  }
}

/**
 * Get inscriptions from Ordiscan API
 */
export async function getOrdiscanInscriptions(page = 1, limit = 20) {
  if (!ORDISCAN_API_KEY) {
    return { 
      error: 'Ordiscan API key not configured on server', 
      status: 500 
    };
  }
  
  try {
    console.log(`Fetching all inscriptions from Ordiscan API (page: ${page}, limit: ${limit})`);
    
    // Proxy request to Ordiscan API
    const response = await fetch(
      `${ORDISCAN_API_URL}/inscriptions?page=${page}&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${ORDISCAN_API_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ordiscan API error (${response.status}): ${errorText}`);
      
      return { 
        error: `Ordiscan API error: ${response.status} ${response.statusText}`, 
        status: response.status,
        details: errorText
      };
    }
    
    // Log the first part of the response for debugging
    const data = await response.json() as Record<string, any>;
    console.log(`Ordiscan API inscriptions response structure:`, Object.keys(data));
    
    // Pass through the data directly without modification to ensure the frontend
    // can handle any structure changes from the Ordiscan API
    return data;
  } catch (error) {
    console.error('Error proxying to Ordiscan:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

/**
 * Get a specific inscription by ID from Ordiscan API
 */
export async function getOrdiscanInscriptionById(inscriptionId: string) {
  if (!ORDISCAN_API_KEY) {
    return { 
      error: 'Ordiscan API key not configured on server', 
      status: 500 
    };
  }
  
  try {
    // Proxy request to Ordiscan API
    const response = await fetch(
      `${ORDISCAN_API_URL}/inscription/${inscriptionId}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${ORDISCAN_API_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      return { 
        error: `Ordiscan API error: ${response.status} ${response.statusText}`, 
        status: response.status 
      };
    }
    
    // Forward the response from Ordiscan
    return await response.json();
  } catch (error) {
    console.error('Error proxying to Ordiscan:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

/**
 * Get inscriptions for a specific address from Ordiscan API
 */
export async function getOrdiscanAddressInscriptions(address: string, page = 1, limit = 20) {
  if (!ORDISCAN_API_KEY) {
    return { 
      error: 'Ordiscan API key not configured on server', 
      status: 500 
    };
  }
  
  try {
    console.log(`Fetching inscriptions for address ${address} from Ordiscan API (page: ${page}, limit: ${limit})`);
    
    // Proxy request to Ordiscan API
    // According to docs: https://ordiscan.com/docs/api#address-inscriptions
    const response = await fetch(
      `${ORDISCAN_API_URL}/address/${address}/inscriptions?page=${page}&limit=${limit}`,
      {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${ORDISCAN_API_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ordiscan API error (${response.status}): ${errorText}`);
      
      return { 
        error: `Ordiscan API error: ${response.status} ${response.statusText}`, 
        status: response.status,
        details: errorText
      };
    }
    
    // Log the first part of the response for debugging
    const data = await response.json() as Record<string, any>;
    console.log(`Ordiscan API response structure for address ${address}:`, Object.keys(data));
    
    // Pass through the data directly without modification
    return data;
  } catch (error) {
    console.error('Error proxying to Ordiscan:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

/**
 * Get inscription content from Ordiscan API
 */
export async function getOrdiscanInscriptionContent(inscriptionId: string) {
  if (!ORDISCAN_API_KEY) {
    return { 
      error: 'Ordiscan API key not configured on server', 
      status: 500 
    };
  }
  
  try {
    // Proxy request to Ordiscan API
    const response = await fetch(
      `${ORDISCAN_API_URL}/content/${inscriptionId}`,
      {
        headers: {
          'Authorization': `Bearer ${ORDISCAN_API_KEY}`
        }
      }
    );
    
    if (!response.ok) {
      return { 
        error: `Ordiscan API error: ${response.status} ${response.statusText}`, 
        status: response.status 
      };
    }
    
    // Get the content type
    const contentType = response.headers.get('Content-Type');
    
    // Handle different content types
    if (contentType?.includes('application/json')) {
      return await response.json();
    } else if (contentType?.includes('text/')) {
      return await response.text();
    } else {
      // For binary data, return the raw response
      return response;
    }
  } catch (error) {
    console.error('Error proxying to Ordiscan:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
} 