/**
 * MIME Type Handling and Content Preparation for Ordinals Inscriptions
 * 
 * This module provides functionality for preparing and formatting
 * different content types for inscriptions, with proper MIME type handling.
 */

import { utf8 } from '@scure/base';

/**
 * Supported MIME types for inscriptions
 */
export enum MimeType {
  // Text formats
  PLAIN_TEXT = 'text/plain',
  HTML = 'text/html',
  CSS = 'text/css',
  
  // Application formats
  JSON = 'application/json',
  JAVASCRIPT = 'application/javascript',
  
  // Image formats
  PNG = 'image/png',
  JPEG = 'image/jpeg',
  SVG = 'image/svg+xml',
  GIF = 'image/gif',
  WEBP = 'image/webp',
  
  // Audio formats
  MP3 = 'audio/mpeg',
  WAV = 'audio/wav',
  
  // Video formats
  MP4 = 'video/mp4',
  WEBM = 'video/webm',
  
  // Other formats
  BINARY = 'application/octet-stream',
}

/**
 * Content type and data for an inscription
 */
export interface InscriptionContent {
  /** MIME type of the content */
  contentType: string;
  /** The encoded content as a Uint8Array */
  content: Uint8Array;
  /** Optional metadata for the inscription */
  metadata?: Record<string, string>;
  /** Optional pointer tag to target a specific sat offset in the input */
  pointer?: bigint;
}

/**
 * Maximum size limit for inscriptions (in bytes)
 * This is a conservative default, can be adjusted based on chain rules
 */
export const MAX_INSCRIPTION_SIZE = 350 * 1024; // 350KB

/**
 * Metadata fields that can be included in an inscription
 */
export interface InscriptionMetadata {
  [key: string]: string;
}

/**
 * Extract file extension from a filename
 * 
 * @param filename - The filename to extract extension from
 * @returns The file extension (without dot)
 */
export function getFileExtension(filename: string): string {
  if (!filename) return '';
  
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1 || lastDotIndex === 0) {
    // No dot or it's the first character (hidden file on Unix)
    return lastDotIndex === 0 ? filename.slice(1) : '';
  }
  
  return filename.slice(lastDotIndex + 1);
}

/**
 * Detect content type from file extension or content
 * 
 * @param filename - The filename to extract extension from
 * @param content - The content to analyze (optional)
 * @param charset - The character set for text content (optional)
 * @returns The detected MIME type
 */
export function detectContentType(
  filename: string | null, 
  content?: string | Uint8Array,
  charset?: string
): string {
  // Get base MIME type
  let mimeType: string;
  
  if (filename) {
    const extension = getFileExtension(filename);
    
    // Detect from extension
    switch (extension.toLowerCase()) {
      case 'txt':
        mimeType = MimeType.PLAIN_TEXT;
        break;
      case 'html':
      case 'htm':
        mimeType = MimeType.HTML;
        break;
      case 'json':
        mimeType = MimeType.JSON;
        break;
      case 'js':
        mimeType = MimeType.JAVASCRIPT;
        break;
      case 'png':
        mimeType = MimeType.PNG;
        break;
      case 'jpg':
      case 'jpeg':
        mimeType = MimeType.JPEG;
        break;
      case 'svg':
        mimeType = MimeType.SVG;
        break;
      case 'webp':
        mimeType = MimeType.WEBP;
        break;
      case 'gif':
        mimeType = MimeType.GIF;
        break;
      default:
        mimeType = MimeType.BINARY;
    }
  } else if (content) {
    // Try to detect from content
    if (typeof content === 'string') {
      if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
        try {
          JSON.parse(content);
          mimeType = MimeType.JSON;
        } catch {
          mimeType = MimeType.PLAIN_TEXT;
        }
      } else if (content.trim().startsWith('<html')) {
        mimeType = MimeType.HTML;
      } else {
        mimeType = MimeType.PLAIN_TEXT;
      }
    } else {
      // Binary content - hard to detect accurately without more analysis
      mimeType = MimeType.BINARY;
    }
  } else {
    // Default fallback
    mimeType = MimeType.BINARY;
  }
  
  // Add charset for text types if specified
  if (charset && (
    mimeType === MimeType.PLAIN_TEXT || 
    mimeType === MimeType.HTML || 
    mimeType === MimeType.JSON ||
    mimeType === MimeType.JAVASCRIPT
  )) {
    return `${mimeType};charset=${charset}`;
  }
  
  return mimeType;
}

/**
 * Guesses the MIME type based on file extension or content
 * 
 * @param filename - Filename or path to determine the MIME type
 * @param content - Optional content to analyze if filename doesn't provide enough information
 * @returns The guessed MIME type
 */
export function guessMimeType(filename: string, content?: Uint8Array | string): string {
  // Extract extension from filename
  const extension = filename.toLowerCase().split('.').pop() || '';
  
  // Check for common extensions
  switch (extension) {
    // Text formats
    case 'txt': return MimeType.PLAIN_TEXT;
    case 'html': case 'htm': return MimeType.HTML;
    case 'css': return MimeType.CSS;
    
    // Application formats
    case 'json': return MimeType.JSON;
    case 'js': return MimeType.JAVASCRIPT;
    
    // Image formats
    case 'png': return MimeType.PNG;
    case 'jpg': case 'jpeg': return MimeType.JPEG;
    case 'svg': return MimeType.SVG;
    case 'gif': return MimeType.GIF;
    case 'webp': return MimeType.WEBP;
    
    // Audio formats
    case 'mp3': return MimeType.MP3;
    case 'wav': return MimeType.WAV;
    
    // Video formats
    case 'mp4': return MimeType.MP4;
    case 'webm': return MimeType.WEBM;
  }
  
  // If extension didn't provide a match and content is provided, try to detect from content
  if (content) {
    // Check if content is a string and try to detect if it's JSON
    if (typeof content === 'string') {
      try {
        JSON.parse(content);
        return MimeType.JSON;
      } catch {
        // Not JSON, assume plain text
        return MimeType.PLAIN_TEXT;
      }
    } else {
      // Binary content detection based on magic numbers (file signatures)
      // Only check the first few bytes
      
      // PNG signature: 89 50 4E 47 0D 0A 1A 0A
      if (content.length > 8 && 
          content[0] === 0x89 && 
          content[1] === 0x50 && 
          content[2] === 0x4E && 
          content[3] === 0x47) {
        return MimeType.PNG;
      }
      
      // JPEG signature: FF D8 FF
      if (content.length > 3 && 
          content[0] === 0xFF && 
          content[1] === 0xD8 && 
          content[2] === 0xFF) {
        return MimeType.JPEG;
      }
      
      // GIF signature: 47 49 46 38
      if (content.length > 4 && 
          content[0] === 0x47 && 
          content[1] === 0x49 && 
          content[2] === 0x46 && 
          content[3] === 0x38) {
        return MimeType.GIF;
      }
      
      // MP3 signature: ID3 or FFFB
      if (content.length > 3 && 
         ((content[0] === 0x49 && content[1] === 0x44 && content[2] === 0x33) || 
          (content[0] === 0xFF && content[1] === 0xFB))) {
        return MimeType.MP3;
      }
      
      // MP4 signature: check for ftyp at byte 4
      if (content.length > 8 && 
          content[4] === 0x66 && 
          content[5] === 0x74 && 
          content[6] === 0x79 && 
          content[7] === 0x70) {
        return MimeType.MP4;
      }
    }
  }
  
  // Default to binary if no match found
  return MimeType.BINARY;
}

/**
 * Validates content for inscription
 * 
 * @param content - The content to validate
 * @param contentType - The content type (MIME type)
 * @returns True if the content is valid for the given content type
 * @throws Error if content is invalid or too large
 */
export function validateContent(content: Uint8Array | string, contentType: string): boolean {
  // Check content size
  const contentSize = typeof content === 'string' 
    ? new TextEncoder().encode(content).length 
    : content.length;
    
  if (contentSize > MAX_INSCRIPTION_SIZE) {
    throw new Error(`Content size (${contentSize} bytes) exceeds maximum allowed size (${MAX_INSCRIPTION_SIZE} bytes)`);
  }
  
  // Validate content based on content type
  if (contentType === MimeType.JSON && typeof content === 'string') {
    try {
      JSON.parse(content);
    } catch (e) {
      throw new Error(`Invalid JSON content: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  
  // All validations passed
  return true;
}

/**
 * Prepares content for inscription
 * 
 * @param content - The content to inscribe (string or binary data)
 * @param contentType - The MIME type of the content
 * @param metadata - Optional metadata to include with the inscription
 * @returns Prepared inscription content as a Uint8Array
 * @throws Error if content is invalid or too large
 */
export function prepareContent(
  content: Uint8Array | string,
  contentType: string,
  metadata?: InscriptionMetadata,
  pointer?: bigint
): InscriptionContent {
  // Validate content
  validateContent(content, contentType);
  
  // Convert string content to Uint8Array if needed
  let contentBytes: Uint8Array;
  
  if (typeof content === 'string') {
    // Handle different string content types
    if (contentType === MimeType.JSON) {
      // Ensure JSON is properly formatted
      try {
        const parsedJson = JSON.parse(content);
        const formattedJson = JSON.stringify(parsedJson);
        contentBytes = utf8.decode(formattedJson);
      } catch (e) {
        throw new Error(`Invalid JSON content: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      // General string content (text, html, etc.)
      contentBytes = utf8.decode(content);
    }
  } else {
    // Binary content (already a Uint8Array)
    contentBytes = content;
  }
  
  return {
    contentType,
    content: contentBytes,
    metadata,
    pointer
  };
}

/**
 * Chunks large content into smaller pieces for multiple inscriptions
 * 
 * @param content - The content to chunk
 * @param chunkSize - Maximum size of each chunk in bytes
 * @returns Array of content chunks as Uint8Array
 */
export function chunkContent(content: Uint8Array, chunkSize: number = MAX_INSCRIPTION_SIZE): Uint8Array[] {
  if (content.length <= chunkSize) {
    return [content];
  }
  
  const chunks: Uint8Array[] = [];
  let offset = 0;
  
  while (offset < content.length) {
    const end = Math.min(offset + chunkSize, content.length);
    chunks.push(content.slice(offset, end));
    offset = end;
  }
  
  return chunks;
} 