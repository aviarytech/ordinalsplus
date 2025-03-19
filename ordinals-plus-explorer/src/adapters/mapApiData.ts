import { LinkedResource, ApiResponse } from '../types';

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
  return {
    id: resource.id || '',
    resourceId: resource.id || '', // Use id as resourceId for consistency
    type: resource.type || 'unknown',
    resourceType: resource.type || 'unknown', // Normalize type for display
    didReference: resource.didReference || undefined,
    did: resource.didReference || '', // Use didReference as did
    inscriptionId: resource.inscriptionId || '',
    contentType: resource.contentType || 'application/json',
    content: resource.content || '',
    createdAt: resource.timestamp || new Date().toISOString(),
  };
}

/**
 * Maps raw API response data to the format expected by the UI components
 */
export function mapApiResponse(responseData: RawApiResponse): ApiResponse {
  return {
    dids: Array.isArray(responseData.dids) ? responseData.dids.map((did: RawDID) => ({
      id: did.id || '',
      inscriptionId: did.inscriptionId || '',
      contentType: did.contentType || 'application/json',
      content: did.content || {},
    })) : [],
    linkedResources: Array.isArray(responseData.linkedResources) 
      ? responseData.linkedResources.map(mapLinkedResource) 
      : [],
    page: responseData.page || 0,
    totalItems: responseData.totalItems || 0,
    itemsPerPage: responseData.itemsPerPage || 20,
    error: responseData.error || undefined,
  };
} 