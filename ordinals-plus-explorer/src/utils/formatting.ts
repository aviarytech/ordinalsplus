/**
 * Truncates a string with ellipsis in the middle
 * @param str - The string to truncate
 * @param startChars - Number of characters to keep at the start
 * @param endChars - Number of characters to keep at the end
 * @returns The truncated string
 */
export function truncateMiddle(str: string, startChars = 8, endChars = 8): string {
  if (!str) return '';
  if (str.length <= startChars + endChars) return str;
  
  return `${str.substring(0, startChars)}...${str.substring(str.length - endChars)}`;
}

/**
 * Formats a DID for display
 * @param didString - The DID string
 * @returns Formatted DID for display
 */
export function formatDid(didString: string): string {
  if (!didString) return '';
  
  // Simply return the full DID without truncation
  return didString;
}

/**
 * Formats a resource ID for display
 * @param resourceId - The resource ID (can be a DID or resource ID)
 * @returns Formatted resource ID for display
 */
export function formatResourceId(resourceId: string): string {
  if (!resourceId) return '';
  
  // Return the full resource ID without truncation
  return resourceId;
}

/**
 * Formats a date string to a readable format
 * @param dateStr - ISO date string
 * @returns Formatted date string
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  
  try {
    const date = new Date(dateStr);
    return date.toLocaleString();
  } catch (e) {
    return dateStr;
  }
}

/**
 * Formats a number with commas
 * @param num - The number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number): string {
  if (num === undefined || num === null) return '';
  
  return num.toLocaleString();
}

/**
 * Gets the short name for a content type
 * @param contentType - MIME content type
 * @returns Short name for display
 */
export function getContentTypeShortName(contentType: string): string {
  if (!contentType) return 'Unknown';
  
  const contentTypeMap: Record<string, string> = {
    'application/json': 'JSON',
    'application/ld+json': 'JSON-LD',
    'text/html': 'HTML',
    'text/plain': 'Text',
    'image/png': 'PNG',
    'image/jpeg': 'JPEG',
    'image/svg+xml': 'SVG',
    'application/pdf': 'PDF'
  };
  
  // Check for exact match
  if (contentTypeMap[contentType]) {
    return contentTypeMap[contentType];
  }
  
  // Check for partial match
  for (const [key, value] of Object.entries(contentTypeMap)) {
    if (contentType.includes(key)) {
      return value;
    }
  }
  
  // Return the part after the slash
  const parts = contentType.split('/');
  if (parts.length === 2) {
    return parts[1].toUpperCase();
  }
  
  return 'Unknown';
} 