import { isValidResourceId } from '../utils/validators';

/**
 * Formats the content data object for resource inscription by wrapping it in a 'data' key.
 * The responsibility of including any 'parent' field within the contentData object lies with the caller.
 *
 * @param contentData - The JavaScript object representing the resource's data (potentially including a 'parent' key).
 * @returns A JSON string representation suitable for inscription content, e.g., '{"data":{...}}'.
 */
export function formatResourceContent(contentData: object): string {
  if (typeof contentData !== 'object' || contentData === null) {
    throw new Error('Invalid contentData: Input must be a non-null object.');
  }
  // Optional: Add validation for parentId format if present within contentData
  if ('parent' in contentData && typeof (contentData as any).parent === 'string') {
    if (!isValidResourceId((contentData as any).parent)) {
       console.warn(`Potential invalid parent format: ${(contentData as any).parent}. Proceeding anyway.`);
       // Decide whether to throw an error or just warn. Warning for now.
       // throw new Error(`Invalid parent format: ${(contentData as any).parent}. Must be 'did:btco:<sat>/<index>'.`);
    }
  }
  return JSON.stringify({ data: contentData });
} 