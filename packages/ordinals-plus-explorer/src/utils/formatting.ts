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
 * Formats a resource ID for display, ensuring the DID format is preserved
 * and properly formatted.
 */
export const formatResourceId = (id: string | undefined): string => {
  if (!id) return 'Unknown';
  
  // Handle DIDs in the format did:btco:<sat number>/<index>
  if (id.startsWith('did:btco:')) {
    // Preserve the entire DID format as is
    return id;
  }
  
  // For inscription IDs that are not in DID format yet
  // Check if it's a valid hex string that could be a transaction ID
  if (/^[a-fA-F0-9]{64}(i\d+)?$/.test(id)) {
    // It's likely a transaction ID or inscription ID
    // We could format as did:btco:<sat number>/<index> if we had the sat info
    return id;
  }
  
  return id;
};

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