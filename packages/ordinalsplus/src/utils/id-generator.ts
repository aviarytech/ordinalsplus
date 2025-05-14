/**
 * ID Generator Utility
 * 
 * This module provides functions for generating unique IDs used throughout the application.
 */

/**
 * Generate a unique ID with an optional prefix
 * Uses a combination of timestamp and random values to ensure uniqueness
 * 
 * @param prefix - Optional prefix to prepend to the ID
 * @returns A unique string ID
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  
  return `${prefix}${timestamp}-${randomPart}`;
} 