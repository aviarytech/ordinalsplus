/**
 * Ord Node API Proxy Service
 * 
 * This service provides functions to proxy requests to the local Ord node
 * keeping all network access within the backend.
 */

// Configure the URL of the Ord node
const ORD_NODE_URL = process.env.ORD_NODE_URL || 'http://localhost:9001';

/**
 * Check if the Ord node is available
 */
export async function getOrdNodeStatus() {
  try {
    // First, try fetching the status endpoint
    const statusResponse = await fetch(`${ORD_NODE_URL}/status`, {
      headers: {
        'Accept': 'application/json'
      },
      // Set a timeout to avoid waiting too long
      signal: AbortSignal.timeout(5000)
    });
    
    if (!statusResponse.ok) {
      console.warn(`Ord node status endpoint returned ${statusResponse.status}`);
      
      // If status endpoint fails, try the inscriptions endpoint as a backup
      const inscriptionsResponse = await fetch(`${ORD_NODE_URL}/inscriptions?limit=1`, {
        headers: {
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!inscriptionsResponse.ok) {
        return { 
          status: 'unavailable',
          code: inscriptionsResponse.status,
          message: `Ord node returned status ${inscriptionsResponse.status}`
        };
      }
      
      // Try to parse the inscriptions response to verify the expected format
      const data = await inscriptionsResponse.json() as Record<string, any>;
      
      // Check for various possible formats to determine if valid
      const isValid = 
        (data.ids && Array.isArray(data.ids)) || 
        (data.inscriptions && Array.isArray(data.inscriptions)) ||
        (data.results && Array.isArray(data.results)) ||
        (data.data && Array.isArray(data.data));
      
      if (!isValid) {
        console.warn('Ord node returned unrecognized response format:', Object.keys(data));
        return {
          status: 'unavailable',
          code: 500,
          message: 'Ord node returned unrecognized response format'
        };
      }
      
      return { 
        status: 'available',
        code: 200,
        message: 'Ord node is available (inscriptions endpoint)',
        format: {
          hasIds: !!data.ids,
          hasInscriptions: !!data.inscriptions,
          hasResults: !!data.results,
          hasData: !!data.data
        }
      };
    }
    
    const data = await statusResponse.json();
    
    return { 
      status: 'available',
      code: 200,
      message: 'Ord node is available (status endpoint)',
      data
    };
  } catch (error) {
    console.error('Error checking Ord node status:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 'unavailable',
      code: 500 
    };
  }
}

/**
 * Get all inscriptions from Ord node
 */
export async function getOrdNodeInscriptions(page = 0, limit = 20) {
  try {
    // Calculate offset for pagination
    const offset = page * limit;
    
    // Log the request for debugging
    console.log(`Fetching inscriptions from Ord node: ${ORD_NODE_URL}/inscriptions?limit=${limit}&offset=${offset}`);
    
    // Fetch inscriptions with pagination
    const response = await fetch(
      `${ORD_NODE_URL}/inscriptions?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      console.error(`Ord node API error (${response.status}): ${response.statusText}`);
      return { 
        error: `Ord node API error: ${response.status} ${response.statusText}`, 
        status: response.status 
      };
    }
    
    // Process the response and transform it to our expected API format
    const data = await response.json() as Record<string, any>;
    
    // Log the keys of the response for debugging
    console.log('Ord node response structure:', Object.keys(data));
    
    // Check if data is an array directly
    if (Array.isArray(data)) {
      console.log('Ord node returned an array directly, treating as inscriptions');
      
      // Transform the array response into our standard format
      const result = {
        linkedResources: data.map(inscription => ({
          id: inscription.id,
          inscriptionId: inscription.id,
          resourceId: createResourceIdFromInscription(inscription),
          type: inferResourceType(inscription),
          resourceType: inferResourceType(inscription),
          didReference: extractDidReference(inscription),
          contentType: inscription.content_type || 'application/json',
          content: inscription.content || {},
          createdAt: inscription.timestamp || new Date().toISOString()
        })),
        dids: data
          .filter(inscription => isDIDInscription(inscription))
          .map(inscription => ({
            id: extractDidReference(inscription),
            inscriptionId: inscription.id,
            contentType: inscription.content_type || 'application/json',
            content: inscription.content
          })),
        page,
        totalItems: data.length,
        itemsPerPage: limit
      };
      
      return result;
    }

    // Check for the updated Ord format with 'ids', 'more', and 'page_index' fields
    if (data.ids && Array.isArray(data.ids)) {
      console.log('Found inscriptions in "ids" field');
      
      // We need to fetch each inscription by ID to get full details
      const inscriptionPromises = data.ids.map((id: string) => 
        fetch(`${ORD_NODE_URL}/inscription/${id}`, {
          headers: {
            'Accept': 'application/json'
          }
        }).then(res => {
          if (!res.ok) {
            console.warn(`Failed to fetch inscription ${id}: ${res.status} ${res.statusText}`);
            return null;
          }
          return res.json();
        })
      );
      
      const inscriptionsWithNulls = await Promise.all(inscriptionPromises);
      const inscriptions = inscriptionsWithNulls.filter(Boolean) as Record<string, any>[];
      
      // Log success message
      console.log(`Successfully fetched ${inscriptions.length} inscriptions from IDs`);
      
      // Transform the response into our standard format
      const result = {
        linkedResources: inscriptions.map(inscription => ({
          id: inscription.id,
          inscriptionId: inscription.id,
          resourceId: createResourceIdFromInscription(inscription),
          type: inferResourceType(inscription),
          resourceType: inferResourceType(inscription),
          didReference: extractDidReference(inscription),
          contentType: inscription.content_type || 'application/json',
          content: inscription.content || {},
          createdAt: inscription.timestamp || new Date().toISOString()
        })),
        dids: inscriptions
          .filter(inscription => isDIDInscription(inscription))
          .map(inscription => ({
            id: extractDidReference(inscription),
            inscriptionId: inscription.id,
            contentType: inscription.content_type || 'application/json',
            content: inscription.content
          })),
        page,
        totalItems: data.ids.length,
        itemsPerPage: limit,
        hasMore: data.more === true
      };
      
      return result;
    }
    
    // Check for newer Ord API format with inscriptions field
    if (!data.inscriptions || !Array.isArray(data.inscriptions)) {
      console.error('Invalid Ord node response format:', data);
      
      // Try to determine the format of the data for better error messages
      if (data.results && Array.isArray(data.results)) {
        console.log('Found inscriptions in "results" field instead of "inscriptions"');
        
        // Use the results field instead
        const result = {
          linkedResources: data.results.map(inscription => ({
            id: inscription.id,
            inscriptionId: inscription.id,
            resourceId: createResourceIdFromInscription(inscription),
            type: inferResourceType(inscription),
            resourceType: inferResourceType(inscription),
            didReference: extractDidReference(inscription),
            contentType: inscription.content_type || 'application/json',
            content: inscription.content || {},
            createdAt: inscription.timestamp || new Date().toISOString()
          })),
          dids: data.results
            .filter(inscription => isDIDInscription(inscription))
            .map(inscription => ({
              id: extractDidReference(inscription),
              inscriptionId: inscription.id,
              contentType: inscription.content_type || 'application/json',
              content: inscription.content
            })),
          page,
          totalItems: data.total || data.results.length,
          itemsPerPage: limit
        };
        
        return result;
      }
      
      // Flatten any nested structure in the response if needed
      if (data.data && Array.isArray(data.data)) {
        console.log('Found inscriptions in "data" field');
        
        // Use the data field
        const result = {
          linkedResources: data.data.map(inscription => ({
            id: inscription.id,
            inscriptionId: inscription.id,
            resourceId: createResourceIdFromInscription(inscription),
            type: inferResourceType(inscription),
            resourceType: inferResourceType(inscription),
            didReference: extractDidReference(inscription),
            contentType: inscription.content_type || 'application/json',
            content: inscription.content || {},
            createdAt: inscription.timestamp || new Date().toISOString()
          })),
          dids: data.data
            .filter(inscription => isDIDInscription(inscription))
            .map(inscription => ({
              id: extractDidReference(inscription),
              inscriptionId: inscription.id,
              contentType: inscription.content_type || 'application/json',
              content: inscription.content
            })),
          page,
          totalItems: data.total || data.data.length,
          itemsPerPage: limit
        };
        
        return result;
      }
      
      return {
        error: 'Invalid response format from Ord node',
        status: 500,
        details: 'Response does not contain a supported inscriptions format'
      };
    }
    
    // Transform the response into our standard format
    const result = {
      linkedResources: data.inscriptions.map(inscription => ({
        id: inscription.id,
        inscriptionId: inscription.id,
        resourceId: createResourceIdFromInscription(inscription),
        type: inferResourceType(inscription),
        resourceType: inferResourceType(inscription),
        didReference: extractDidReference(inscription),
        contentType: inscription.content_type || 'application/json',
        content: inscription.content || {},
        createdAt: inscription.timestamp || new Date().toISOString()
      })),
      dids: data.inscriptions
        .filter(inscription => isDIDInscription(inscription))
        .map(inscription => ({
          id: extractDidReference(inscription),
          inscriptionId: inscription.id,
          contentType: inscription.content_type || 'application/json',
          content: inscription.content
        })),
      page,
      totalItems: data.total || data.inscriptions.length,
      itemsPerPage: limit
    };
    
    return result;
  } catch (error) {
    console.error('Error proxying to Ord node:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

/**
 * Get inscriptions for a specific address from Ord node
 */
export async function getOrdNodeAddressInscriptions(address: string, page = 0, limit = 20) {
  try {
    // Log the request for debugging
    console.log(`Fetching inscriptions for address ${address} from Ord node`);
    
    // Fetch address information
    const addressResponse = await fetch(
      `${ORD_NODE_URL}/address/${address}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!addressResponse.ok) {
      console.error(`Ord node API error (${addressResponse.status}): ${addressResponse.statusText}`);
      return { 
        error: `Ord node API error: ${addressResponse.status} ${addressResponse.statusText}`, 
        status: addressResponse.status 
      };
    }
    
    const addressData = await addressResponse.json() as Record<string, any>;
    
    // Log the keys of the response for debugging
    console.log(`Ord node address response structure for ${address}:`, Object.keys(addressData));
    
    // Check different potential formats of the address data
    let inscriptionIds: string[] = [];
    
    if (Array.isArray(addressData)) {
      console.log('Ord node returned an array directly for address');
      inscriptionIds = addressData.map(item => item.id || item);
    } else if (addressData.inscriptions && Array.isArray(addressData.inscriptions)) {
      inscriptionIds = addressData.inscriptions;
    } else if (addressData.data && Array.isArray(addressData.data)) {
      inscriptionIds = addressData.data.map((item: any) => item.id || item);
    } else if (addressData.results && Array.isArray(addressData.results)) {
      inscriptionIds = addressData.results.map((item: any) => item.id || item);
    } else {
      console.error('Invalid Ord node address response format:', addressData);
      return {
        error: 'No inscriptions found for this address or invalid response format',
        status: 404,
        details: 'Response does not contain an inscriptions array'
      };
    }
    
    if (inscriptionIds.length === 0) {
      return {
        linkedResources: [],
        dids: [],
        page,
        totalItems: 0,
        itemsPerPage: limit
      };
    }
    
    // Calculate pagination
    const startIdx = page * limit;
    const endIdx = Math.min(startIdx + limit, inscriptionIds.length);
    const paginatedIds = inscriptionIds.slice(startIdx, endIdx);
    
    // Fetch details for each inscription
    const inscriptionPromises = paginatedIds.map((id: string) => 
      fetch(`${ORD_NODE_URL}/inscription/${id}`, {
        headers: {
          'Accept': 'application/json'
        }
      }).then(res => {
        if (!res.ok) {
          console.warn(`Failed to fetch inscription ${id}: ${res.status} ${res.statusText}`);
          return null;
        }
        return res.json();
      })
    );
    
    const inscriptionsWithNulls = await Promise.all(inscriptionPromises);
    const inscriptions = inscriptionsWithNulls.filter(Boolean) as Record<string, any>[];
    
    // Log success message
    console.log(`Successfully fetched ${inscriptions.length} inscriptions for address ${address}`);
    
    // Transform the response into our standard format
    const result = {
      linkedResources: inscriptions.map(inscription => ({
        id: inscription.id,
        inscriptionId: inscription.id,
        resourceId: createResourceIdFromInscription(inscription),
        type: inferResourceType(inscription),
        resourceType: inferResourceType(inscription),
        didReference: extractDidReference(inscription),
        contentType: inscription.content_type || 'application/json',
        content: inscription.content || {},
        createdAt: inscription.timestamp || new Date().toISOString()
      })),
      dids: inscriptions
        .filter(inscription => isDIDInscription(inscription))
        .map(inscription => ({
          id: extractDidReference(inscription),
          inscriptionId: inscription.id,
          contentType: inscription.content_type || 'application/json',
          content: inscription.content
        })),
      page,
      totalItems: inscriptionIds.length,
      itemsPerPage: limit
    };
    
    return result;
  } catch (error) {
    console.error('Error proxying to Ord node:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

/**
 * Get a specific inscription by ID from Ord node
 */
export async function getOrdNodeInscriptionById(inscriptionId: string) {
  try {
    // Fetch the inscription data
    const response = await fetch(
      `${ORD_NODE_URL}/inscription/${inscriptionId}`,
      {
        headers: {
          'Accept': 'application/json'
        }
      }
    );
    
    if (!response.ok) {
      return { 
        error: `Ord node API error: ${response.status} ${response.statusText}`, 
        status: response.status 
      };
    }
    
    // Forward the response
    return await response.json();
  } catch (error) {
    console.error('Error proxying to Ord node:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

/**
 * Get inscription content from Ord node
 */
export async function getOrdNodeInscriptionContent(inscriptionId: string) {
  try {
    // Fetch the inscription content
    const response = await fetch(
      `${ORD_NODE_URL}/content/${inscriptionId}`
    );
    
    if (!response.ok) {
      return { 
        error: `Ord node API error: ${response.status} ${response.statusText}`, 
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
    console.error('Error proxying to Ord node:', error);
    return { 
      error: error instanceof Error ? error.message : 'Unknown error', 
      status: 500 
    };
  }
}

/**
 * Helper function to create a resource ID from an inscription
 */
function createResourceIdFromInscription(inscription: any): string {
  // If sat number is available
  if (inscription.sat) {
    // Extract output index from inscription ID
    let outputIndex = 0;
    if (inscription.id) {
      const match = inscription.id.match(/^[0-9a-f]+i(\d+)$/);
      if (match && match[1]) {
        outputIndex = parseInt(match[1], 10);
      }
    }
    
    return `did:btco:${inscription.sat}/${outputIndex}`;
  }
  
  // Fallback to inscription ID if sat number is not available
  return inscription.id || '';
}

/**
 * Infer the resource type from an inscription
 */
function inferResourceType(inscription: any): string {
  // Try to infer from content type
  const contentType = inscription.content_type || '';
  
  if (contentType.includes('image')) return 'image';
  if (contentType.includes('video')) return 'video';
  if (contentType.includes('audio')) return 'audio';
  
  // For text content, we need to look at the actual content
  if (contentType.includes('text/plain') || contentType.includes('text/html')) {
    // If it's a text content, we should check if it's a DID document or contains JSON
    if (typeof inscription.content === 'string') {
      // Check if the text content appears to be JSON
      try {
        if (inscription.content.trim().startsWith('{') && inscription.content.trim().endsWith('}')) {
          // Try to parse it as JSON
          const jsonContent = JSON.parse(inscription.content);
          
          // Check for DID document
          if (jsonContent.id && typeof jsonContent.id === 'string' && jsonContent.id.startsWith('did:btco:')) {
            return 'identity';
          }
          
          // Check for credential
          if (jsonContent.credentialSubject) return 'credential';
          
          // It's structured data but not a specific known type
          return 'data';
        }
        
        // Check if it's a DID reference in plain text
        if (inscription.content.includes('did:btco:')) {
          return 'identity-reference';
        }
      } catch (e) {
        // Not valid JSON, continue with other checks
      }
    }
    
    // For text content that didn't match any specific type
    return 'text';
  }
  
  // Try to infer from content if it's a JSON
  if ((contentType.includes('json') || contentType === '') && typeof inscription.content === 'object') {
    const content = inscription.content as Record<string, unknown>;
    
    // Look for type field
    if (content.type && typeof content.type === 'string') return content.type;
    if (content.resourceType && typeof content.resourceType === 'string') return content.resourceType;
    
    // Check for DID document
    if (content.id && typeof content.id === 'string' && content.id.startsWith('did:btco:')) {
      return 'identity';
    }
    
    // Check for credential
    if (content.credentialSubject) return 'credential';
  }
  
  return 'unknown';
}

/**
 * Extract DID reference from inscription
 */
function extractDidReference(inscription: any): string | undefined {
  // If it's a JSON with DID reference
  if (typeof inscription.content === 'object') {
    const content = inscription.content as Record<string, unknown>;
    
    if (typeof content.id === 'string' && content.id.startsWith('did:btco:')) {
      return content.id;
    }
    
    if (typeof content.didReference === 'string') {
      return content.didReference;
    }
    
    // Look for reference to a DID in issuer field (for credentials)
    if (typeof content.issuer === 'string' && content.issuer.startsWith('did:btco:')) {
      return content.issuer;
    }
  }
  
  // Try to find DID in content as text
  if (typeof inscription.content === 'string') {
    const didMatch = inscription.content.match(/did:btco:[a-f0-9]+/i);
    return didMatch ? didMatch[0] : undefined;
  }
  
  return undefined;
}

/**
 * Check if inscription is a DID document
 */
function isDIDInscription(inscription: any): boolean {
  if (typeof inscription.content === 'object' && inscription.content !== null) {
    const content = inscription.content as Record<string, unknown>;
    
    // Check if it's a DID document
    if (
      typeof content.id === 'string' && 
      content.id.startsWith('did:btco:') &&
      (content.controller || content.verificationMethod)
    ) {
      return true;
    }
  }
  
  return false;
} 