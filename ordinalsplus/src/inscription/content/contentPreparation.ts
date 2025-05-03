/**
 * Content Preparation Module
 * 
 * Provides functionality for preparing different content types for inscription
 */

/**
 * Prepare content for inscription based on the content type
 * 
 * @param content The content to prepare (can be string, Buffer, or object)
 * @param contentType The MIME type of the content
 * @returns Prepared content ready for inscription
 */
export async function prepareContent(content: any, contentType: string): Promise<Buffer> {
  // Validate content type
  if (!isSupportedContentType(contentType)) {
    throw new Error(`Unsupported content type: ${contentType}`);
  }
  
  // Handle different content types
  if (contentType.startsWith('text/')) {
    return prepareTextContent(content);
  } else if (contentType === 'application/json') {
    return prepareJsonContent(content);
  } else if (contentType.startsWith('image/')) {
    return prepareImageContent(content);
  } else {
    // Default handling for other supported types
    return prepareBinaryContent(content);
  }
}

/**
 * Check if a content type is supported
 */
function isSupportedContentType(contentType: string): boolean {
  const supportedTypes = [
    'text/plain',
    'text/html',
    'text/markdown',
    'application/json',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/svg+xml'
  ];
  
  return supportedTypes.includes(contentType);
}

/**
 * Prepare text content for inscription
 */
function prepareTextContent(content: string): Buffer {
  if (typeof content !== 'string') {
    throw new Error('Text content must be a string');
  }
  
  return Buffer.from(content, 'utf-8');
}

/**
 * Prepare JSON content for inscription
 */
function prepareJsonContent(content: any): Buffer {
  let jsonString: string;
  
  if (typeof content === 'string') {
    // Validate that the string is valid JSON
    try {
      JSON.parse(content);
      jsonString = content;
    } catch (error) {
      throw new Error('Invalid JSON string');
    }
  } else {
    // Convert object to JSON string
    try {
      jsonString = JSON.stringify(content);
    } catch (error) {
      throw new Error('Failed to stringify JSON content');
    }
  }
  
  return Buffer.from(jsonString, 'utf-8');
}

/**
 * Prepare image content for inscription
 */
function prepareImageContent(content: Buffer | string): Buffer {
  if (content instanceof Buffer) {
    return content;
  } else if (typeof content === 'string') {
    // Assume base64 encoded image
    try {
      return Buffer.from(content, 'base64');
    } catch (error) {
      throw new Error('Invalid base64 image data');
    }
  } else {
    throw new Error('Image content must be a Buffer or base64 string');
  }
}

/**
 * Prepare binary content for inscription
 */
function prepareBinaryContent(content: Buffer | string): Buffer {
  if (content instanceof Buffer) {
    return content;
  } else if (typeof content === 'string') {
    // Assume base64 encoded data
    try {
      return Buffer.from(content, 'base64');
    } catch (error) {
      throw new Error('Invalid base64 data');
    }
  } else {
    throw new Error('Binary content must be a Buffer or base64 string');
  }
} 