/**
 * Parses content based on content type
 */
export function parseContent(content: any, contentType: string): { value: any } {
  if (content === undefined || content === null) {
    return { value: undefined };
  }

  // Handle JSON content
  if (contentType === 'application/json') {
    if (typeof content === 'string') {
      try {
        return { value: JSON.parse(content) };
      } catch {
        return { value: content };
      }
    }
    return { value: content };
  }

  // Handle text content
  if (contentType.startsWith('text/')) {
    return { value: content.toString() };
  }

  // Handle binary content
  if (contentType.startsWith('image/') || 
      contentType.startsWith('audio/') || 
      contentType.startsWith('video/')) {
    return { value: content };
  }

  // Default to treating as text
  return { value: content.toString() };
} 