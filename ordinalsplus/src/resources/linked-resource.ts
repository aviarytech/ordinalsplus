import { Inscription, LinkedResource } from '../types';
import { extractSatNumber, extractIndexFromInscription } from '../utils/validators';
import { parseContent as parseContentFromUtils } from '../utils/content-parser';

/**
 * Parses content based on content type
 * @param content The content to parse
 * @param contentType The content type
 * @returns The parsed content
 */
function parseContent(content: any, contentType: string): any {
  // Handle undefined/null content
  if (content === undefined || content === null) {
    return { value: null };
  }

  // For JSON content type
  if (contentType.includes('application/json')) {
    // If content is already an object, return it as is
    if (typeof content === 'object' && content !== null) {
      return content;
    }
    
    // If content is a string that looks like JSON, try to parse it
    if (typeof content === 'string') {
      try {
        return JSON.parse(content);
      } catch (e) {
        // If parsing fails, return as plain text
        return { value: content };
      }
    }
    
    // For any other JSON content, wrap in value object
    return { value: content };
  }

  // For text content types
  if (contentType.startsWith('text/')) {
    return { value: String(content) };
  }

  // Handle binary content types (images, audio, video)
  if (contentType.startsWith('image/') || 
      contentType.startsWith('audio/') || 
      contentType.startsWith('video/')) {
    return { value: content };
  }

  // For all other content types, wrap in value object
  return { value: content };
}

/**
 * Creates a linked resource from an inscription
 * @param inscription The inscription to create the resource from
 * @param type The type of resource to create
 * @returns The created linked resource
 * @throws Error if the inscription is invalid or missing required data
 */
export function createLinkedResourceFromInscription(inscription: Inscription, type: string): LinkedResource {
  if (!inscription || !inscription.id) {
    throw new Error('Invalid inscription');
  }

  const satNumber = extractSatNumber(inscription);
  const index = extractIndexFromInscription(inscription);
  const didReference = `did:btco:${satNumber}`;
  const resourceId = `${didReference}/${index}`;
  const contentType = inscription.content_type || 'application/json';

  return {
    id: resourceId,
    type,
    inscriptionId: inscription.id,
    didReference,
    contentType,
    content: parseContentFromUtils(inscription.content, contentType),
    sat: satNumber
  };
} 