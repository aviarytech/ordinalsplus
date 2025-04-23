import type { LinkedResource, Inscription } from '../types';
import { isValidDid, createLinkedResourceFromInscription } from './didService';

// Common prefixes and identifiers for linked resources
const LINKED_RESOURCE_TYPES = [
  'LinkedResource',
  'LinkedData',
  'LinkedDocument',
  'LinkedCredential',
  'Credential',
  'VerifiableCredential',
  'Document',
  'Resource',
  'Certificate',
  'Collection',
  'Asset',
  'NFT',
  'Token',
  'Image',
  'Media',
  'Link',
  'Reference'
];

// DID reference identifiers - properties that might point to a DID
const DID_REFERENCE_PROPERTIES = [
  'subject',
  'id',
  'did',
  'controller',
  'issuer',
  'holder',
  'reference',
  'verifier',
  'parent',
  'owner',
  'author',
  'creator'
];

/**
 * Extract the index from an inscription ID
 * For example: 152d8afc7939b66953d9633e4d59c3ed086413d34617619811e8295cdb9388fdi0 -> 0
 */
const extractIndexFromInscriptionId = (inscriptionId: string): string => {
  // Look for pattern where inscription ID ends with "i" followed by a number
  const match = inscriptionId.match(/i(\d+)$/);
  if (match && match[1]) {
    return match[1];
  }
  return "0"; // Default to 0 if no index is found
};

/**
 * Generate a proper DID ID from inscription data
 * Format: did:btco:sat/number
 */
const generateDidFromInscription = (inscription: Inscription): string => {
  // Extract the correct index from the inscription ID
  const index = extractIndexFromInscriptionId(inscription.id);
  
  // If we have sat data, use it to form the DID
  if (inscription.sat) {
    return `did:btco:${inscription.sat}/${index}`;
  }
  
  throw new Error('No sat data found in inscription');
};

/**
 * Check if inscription content appears to be a linked resource
 * We'll be more permissive to include various types of resources
 */
export const isLinkedResource = (content: Record<string, unknown>): boolean => {
  // Check if type property exists and is related to linked resources
  if (typeof content.type === 'string') {
    return LINKED_RESOURCE_TYPES.some(type => 
      content.type === type || (content.type as string).includes(type)
    );
  }
  
  // Check if it's an array of types
  if (Array.isArray(content.type)) {
    return content.type.some((t: unknown) => 
      typeof t === 'string' && (
        LINKED_RESOURCE_TYPES.includes(t) || 
        LINKED_RESOURCE_TYPES.some(type => t.includes(type))
      )
    );
  }
  
  // Check properties that might indicate it's a resource
  if (content.resource || content.credential || content.document || 
      content.collection || content.url || content.link || 
      content.reference || content.image || content.media) {
    return true;
  }
  
  // Treat as a resource if it has a name or title
  if (content.name || content.title) {
    return true;
  }
  
  return false;
};

/**
 * Extract DID reference from a linked resource if it exists
 */
export const extractDidReferenceFromLinkedResource = (content: Record<string, unknown>): string | undefined => {
  // Helper to check if a value is a valid DID
  const checkForDid = (value: unknown): string | undefined => {
    if (typeof value === 'string' && isValidDid(value)) {
      return value;
    }
    return undefined;
  };
  
  // Check all properties that might contain a DID reference
  for (const prop of DID_REFERENCE_PROPERTIES) {
    const didRef = checkForDid(content[prop]);
    if (didRef) {
      return didRef;
    }
    
    // Handle nested objects
    if (typeof content[prop] === 'object' && content[prop] !== null) {
      const nestedObj = content[prop] as Record<string, unknown>;
      
      // Try common ID properties in the nested object
      for (const nestedProp of ['id', 'did', 'identifier']) {
        const nestedDidRef = checkForDid(nestedObj[nestedProp]);
        if (nestedDidRef) {
          return nestedDidRef;
        }
      }
    }
  }
  
  return undefined;
};

/**
 * Extract linked resource from an inscription
 * This function now handles both JSON and non-JSON content
 */
export const extractLinkedResourceFromInscription = (inscription: Inscription): LinkedResource | null => {
  try {
    if (!inscription.content_type) {
      return null;
    }
    
    // Ensure inscription ID is available - this is a critical field
    if (!inscription.id) {
      console.warn('Inscription is missing ID, skipping');
      return null;
    }
    
    let content: Record<string, unknown>;
    let resourceType = 'Resource';
    
    // For JSON content
    if (inscription.content_type.includes('application/json')) {
      try {
        // TODO properly handle content_url
        content = JSON.parse(inscription.content_url);
        
        // Check if this is a linked resource
        if (isLinkedResource(content)) {
          // Determine the resource type
          if (typeof content.type === 'string') {
            resourceType = content.type;
          } else if (Array.isArray(content.type)) {
            resourceType = content.type.find((t: unknown) => 
              typeof t === 'string' && (
                LINKED_RESOURCE_TYPES.includes(t) || 
                LINKED_RESOURCE_TYPES.some(type => (t as string).includes(type))
              )
            ) || 'Resource';
          }
          
          // Extract DID reference if it exists
          const didReference = extractDidReferenceFromLinkedResource(content);
          
          // Generate a proper DID for this resource
          const did = generateDidFromInscription(inscription);
          
          return {
            id: did,
            type: resourceType,
            didReference: didReference || `did:btco:${inscription.sat}`,
            inscriptionId: inscription.id,
            contentType: inscription.content_type,
            content_url: inscription.content_url || '',
            sat: typeof inscription.sat === 'string' ? parseInt(inscription.sat, 10) : inscription.sat || 0
          };
        }
      } catch (e) {
        console.log(`Failed to parse JSON from inscription ${inscription.id}`);
      }
    }
    
    // For non-JSON content, we'll create a synthetic resource based on the content type
    resourceType = getResourceTypeFromContentType(inscription.content_type);
    
    // Generate a proper DID for this resource
    const did = generateDidFromInscription(inscription);
    
    return {
      id: did,
      type: resourceType,
      inscriptionId: inscription.id,
      contentType: inscription.content_type,
      content_url: inscription.content_url,
      didReference: `did:btco:${inscription.sat}`,
      sat: typeof inscription.sat === 'string' ? parseInt(inscription.sat, 10) : inscription.sat || 0
    };
    
  } catch (error) {
    console.error('Error extracting linked resource from inscription:', error);
    return null;
  }
};

/**
 * Helper to determine resource type from content type
 */
function getResourceTypeFromContentType(contentType: string): string {
  if (contentType.startsWith('image/')) {
    return 'Image';
  }
  if (contentType.startsWith('video/')) {
    return 'Video';
  }
  if (contentType.startsWith('audio/')) {
    return 'Audio';
  }
  if (contentType.includes('text/html')) {
    return 'HTML';
  }
  if (contentType.includes('text/plain')) {
    return 'Text';
  }
  if (contentType.includes('application/pdf')) {
    return 'PDF';
  }
  if (contentType.includes('application/')) {
    return 'Application';
  }
  
  return 'Resource';
}

/**
 * Extract linked resources from a list of inscriptions
 * Now treating all inscriptions as potential resources
 */
export const extractLinkedResourcesFromInscriptions = (inscriptions: Inscription[]): LinkedResource[] => {
  console.log(`Extracting linked resources from ${inscriptions.length} inscriptions`);
  const resources: LinkedResource[] = [];
  
  for (const inscription of inscriptions) {
    const resource = extractLinkedResourceFromInscription(inscription);
    if (resource) {
      resources.push(resource);
    }
  }
  
  console.log(`Successfully extracted ${resources.length} linked resources`);
  return resources;
};

/**
 * Build a search query for linked resources
 */
export const buildLinkedResourceSearchQuery = (): string => {
  return LINKED_RESOURCE_TYPES.join(' OR ');
};

/**
 * Process a list of inscriptions to extract linked resources
 * @param inscriptions The list of inscriptions to process
 * @param didReferences Optional map of DID references to link resources to
 * @returns List of linked resources
 */
export function processInscriptionsForLinkedResources(
  inscriptions: Inscription[],
  didReferences?: Map<string, string>
): LinkedResource[] {
  const linkedResources: LinkedResource[] = [];
  
  for (const inscription of inscriptions) {
    // Skip inscriptions without content
    if (!inscription.content_url) continue;
    
    // Determine the content type for resource categorization
    const contentType = inscription.content_type || 'application/json';
    
    // Get the appropriate resource type based on content type
    const resourceType = getResourceTypeFromContentType(contentType);
    
    // Find a DID reference for this resource if available
    let didReference: string | undefined;
    if (didReferences && didReferences.has(inscription.id)) {
      didReference = didReferences.get(inscription.id);
    }
    console.log('here222')
    // Create a properly formatted linked resource using our utility function
    const linkedResource = createLinkedResourceFromInscription(
      inscription,
      resourceType,
      didReference
    );
    
    if (linkedResource) {
      linkedResources.push(linkedResource);
    }
  }
  
  return linkedResources;
} 