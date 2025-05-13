/**
 * Truncates a string in the middle, replacing the middle portion with ellipsis
 * @param str The string to truncate
 * @param startChars Number of characters to keep at the beginning
 * @param endChars Number of characters to keep at the end
 * @returns Truncated string with ellipsis in the middle
 */
export function truncateMiddle(str: string, startChars: number = 6, endChars: number = 4): string {
  if (!str) return '';
  if (str.length <= startChars + endChars) return str;
  
  return `${str.substring(0, startChars)}...${str.substring(str.length - endChars)}`;
} 