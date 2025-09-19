import type { InscriptionDetailsResponse } from '../types';
import { env } from '../config/envConfig';

// Environment variable for Ord node URL (default to localhost:80 if not set)
const ORD_NODE_URL = (env.CONTENT_ORD_NODE_URL || env.ORD_NODE_URL) || 'http://127.0.0.1:80';

/**
 * Custom Error class for Inscription not found scenario.
 */
export class InscriptionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InscriptionNotFoundError';
  }
}

/**
 * Fetches inscription details (content type, raw content) from the Ord node.
 *
 * @param inscriptionId - The ID of the inscription to fetch.
 * @returns A promise resolving to the inscription details.
 * @throws {InscriptionNotFoundError} If the inscription is not found (Ord node returns 404).
 * @throws {Error} If any other error occurs during fetching or processing.
 */
export const getInscriptionDetails = async (
  inscriptionId: string
): Promise<InscriptionDetailsResponse> => {
  const url = `${ORD_NODE_URL}/content/${inscriptionId}`;
  console.log(`[inscriptionService] Fetching inscription content from: ${url}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`[inscriptionService] Inscription not found (404): ${inscriptionId}`);
        throw new InscriptionNotFoundError(`Inscription not found: ${inscriptionId}`);
      }
      console.error(`[inscriptionService] Error fetching from Ord node: ${response.status} ${response.statusText}`);
      throw new Error(`Failed to fetch inscription from Ord node: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType) {
        console.warn(`[inscriptionService] Missing Content-Type header for inscription: ${inscriptionId}`);
        // Decide on default or throw error? Let's default for now, but log warning.
        // throw new Error(`Missing Content-Type header from Ord node for inscription ${inscriptionId}`);
    }

    const contentBuffer = await response.arrayBuffer();
    const contentBase64 = Buffer.from(contentBuffer).toString('base64');
    const contentLength = contentBuffer.byteLength;

    console.log(`[inscriptionService] Successfully fetched inscription: ${inscriptionId}, Type: ${contentType}, Size: ${contentLength} bytes`);

    return {
      inscriptionId,
      contentType: contentType || 'application/octet-stream', // Default if missing
      contentBase64,
      contentLength,
    };

  } catch (error: unknown) {
    if (error instanceof InscriptionNotFoundError) {
        throw error; // Re-throw specific error
    }
    console.error(`[inscriptionService] Exception fetching inscription ${inscriptionId}:`, error);
    // Catch network errors (fetch failure) or other unexpected errors
    throw new Error(`Failed to process inscription fetch for ${inscriptionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}; 