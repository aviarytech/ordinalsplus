import { DID, LinkedResource, ApiResponse } from '../types';
// We'll import ordinalsplus package functions once the package is properly installed

interface RawLinkedResource {
  id?: string;
  type?: string;
  didReference?: string;
  inscriptionId?: string;
  contentType?: string;
  content?: unknown;
  timestamp?: string;
}

interface RawDID {
  id?: string;
  inscriptionId?: string;
  contentType?: string;
  content?: unknown;
}

interface RawApiResponse {
  dids?: RawDID[];
  linkedResources?: RawLinkedResource[];
  page?: number;
  totalItems?: number;
  itemsPerPage?: number;
  error?: string;
}

/**
 * Maps raw linked resource data from the API to the format expected by the UI components
 */
export function mapLinkedResource(resource: RawLinkedResource): LinkedResource {
  // Generate a proper resource ID if not provided
  const resourceId = resource.id || '';
  
  // Use the DID reference if available, otherwise fall back to resource ID
  const didRef = resource.didReference || '';
  
  // Process the content based on its type
  let processedContent: string | Record<string, unknown>;
  
  if (typeof resource.content === 'string') {
    processedContent = resource.content;
  } else if (resource.content && typeof resource.content === 'object') {
    processedContent = resource.content as Record<string, unknown>;
  } else {
    // Default to empty object if content is null or undefined
    processedContent = {} as Record<string, unknown>;
  }
  
  return {
    id: resourceId,
    resourceId: resourceId, // Use id as resourceId for consistency
    type: resource.type || 'unknown',
    resourceType: resource.type || 'unknown', // Normalize type for display
    didReference: didRef,
    did: didRef, // Use didReference as did
    inscriptionId: resource.inscriptionId || '',
    contentType: resource.contentType || 'application/json',
    content: processedContent,
    createdAt: resource.timestamp || new Date().toISOString(),
  };
}

/**
 * Maps raw API response data to the format expected by the UI components
 */
export function mapApiResponse(responseData: RawApiResponse): ApiResponse {
  return {
    dids: Array.isArray(responseData.dids) ? responseData.dids.map((did: RawDID) => {
      // Process DID content
      let processedContent: Record<string, unknown>;
      
      if (did.content && typeof did.content === 'object') {
        processedContent = did.content as Record<string, unknown>;
      } else if (typeof did.content === 'string' && did.content.trim().startsWith('{')) {
        try {
          processedContent = JSON.parse(did.content);
        } catch (e) {
          processedContent = { value: did.content };
        }
      } else {
        // Default to object with id if content is null, undefined, or not parseable as JSON
        processedContent = { id: did.id || '' };
      }
      
      return {
        id: did.id || '',
        inscriptionId: did.inscriptionId || '',
        contentType: did.contentType || 'application/json',
        content: processedContent
      } as DID;
    }) : [],
    linkedResources: Array.isArray(responseData.linkedResources) 
      ? responseData.linkedResources.map(mapLinkedResource) 
      : [],
    page: responseData.page || 0,
    totalItems: responseData.totalItems || 0,
    itemsPerPage: responseData.itemsPerPage || 20,
    error: responseData.error || undefined,
  };
} 