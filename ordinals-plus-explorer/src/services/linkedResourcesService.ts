import { LinkedResource, Inscription } from '../types';

// Common prefixes and identifiers for linked resources
const LINKED_RESOURCE_TYPES = [
  'LinkedResource',
  'LinkedData',
  'LinkedDocument',
  'LinkedCredential',
  'Credential',
  'VerifiableCredential'
];

// DID reference identifiers - properties that might point to a DID
const DID_REFERENCE_PROPERTIES = [
  'subject',
  'id',
  'did',
  'controller',
  'issuer',
  'holder'
];

/**
 * Check if inscription content appears to be a linked resource
 */
export const isLinkedResource = (content: Record<string, unknown>): boolean => {
  // Check if type property exists and is related to linked resources
  if (typeof content.type === 'string') {
    return LINKED_RESOURCE_TYPES.some(type => content.type === type);
  }
  
  // Check if it's an array of types
  if (Array.isArray(content.type)) {
    return content.type.some(type => 
      typeof type === 'string' && LINKED_RESOURCE_TYPES.includes(type)
    );
  }
  
  return false;
};

/**
 * Extract DID reference from a linked resource if it exists
 */
export const extractDidReferenceFromLinkedResource = (content: Record<string, unknown>): string | undefined => {
  for (const prop of DID_REFERENCE_PROPERTIES) {
    if (typeof content[prop] === 'string' && (content[prop] as string).startsWith('did:btco:')) {
      return content[prop] as string;
    }
    
    // Handle nested objects like issuer: { id: "did:btco:..." }
    if (typeof content[prop] === 'object' && content[prop] !== null) {
      const nestedObj = content[prop] as Record<string, unknown>;
      if (typeof nestedObj.id === 'string' && (nestedObj.id as string).startsWith('did:btco:')) {
        return nestedObj.id as string;
      }
    }
  }
  
  return undefined;
};

/**
 * Extract linked resource from an inscription
 */
export const extractLinkedResourceFromInscription = (inscription: Inscription): LinkedResource | null => {
  try {
    // Skip non-JSON content
    if (!inscription.content_type.includes('application/json')) {
      return null;
    }
    
    // Parse the content as JSON
    const content = JSON.parse(inscription.content);
    
    // Check if this is a linked resource
    if (!isLinkedResource(content)) {
      return null;
    }
    
    // Determine the resource type
    let resourceType: string;
    if (typeof content.type === 'string') {
      resourceType = content.type;
    } else if (Array.isArray(content.type)) {
      resourceType = content.type.find((t: unknown) => 
        typeof t === 'string' && LINKED_RESOURCE_TYPES.includes(t)
      ) || 'Unknown';
    } else {
      resourceType = 'Unknown';
    }
    
    // Extract DID reference if it exists
    const didReference = extractDidReferenceFromLinkedResource(content);
    
    // Generate a simple ID if none exists
    const id = typeof content.id === 'string' ? content.id : `resource:${inscription.id}`;
    
    return {
      id,
      type: resourceType,
      didReference,
      inscriptionId: inscription.id,
      contentType: inscription.content_type,
      content
    };
  } catch (error) {
    console.error('Error extracting linked resource from inscription:', error);
    return null;
  }
};

/**
 * Extract linked resources from a list of inscriptions
 */
export const extractLinkedResourcesFromInscriptions = (inscriptions: Inscription[]): LinkedResource[] => {
  const resources: LinkedResource[] = [];
  
  for (const inscription of inscriptions) {
    const resource = extractLinkedResourceFromInscription(inscription);
    if (resource) {
      resources.push(resource);
    }
  }
  
  return resources;
};

/**
 * Build a search query string for finding linked resources in inscriptions
 */
export const buildLinkedResourceSearchQuery = (): string => {
  return 'LinkedResource|VerifiableCredential';
};
