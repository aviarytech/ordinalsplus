import { ApiClient } from '../utils/api-client';
import { isValidBtcoDid, parseBtcoDid } from '../utils/validators';
import { ERROR_CODES } from '../utils/constants';
import { 
  ApiOptions,
  BtcoDidString,
  DidDocument,
  DidResolutionResult
} from '../types';

/**
 * Class for working with BTCO DIDs
 */
export class BtcoDid {
  private didString: BtcoDidString;
  private apiClient: ApiClient;

  /**
   * Creates a new BtcoDid instance
   * @param did - The BTCO DID string
   * @param options - API client options
   * @throws If the DID is invalid
   */
  constructor(did: string, options: ApiOptions = {}) {
    if (!isValidBtcoDid(did)) {
      throw {
        error: ERROR_CODES.INVALID_DID,
        message: `Invalid BTCO DID: ${did}`
      };
    }

    this.didString = did as BtcoDidString;
    this.apiClient = new ApiClient(options);
  }

  /**
   * Gets the DID string
   * @returns The DID string
   */
  getDid(): BtcoDidString {
    return this.didString;
  }

  /**
   * Gets the sat number from the DID
   * @returns The sat number
   */
  getSatNumber(): string {
    const parsed = parseBtcoDid(this.didString);
    return parsed ? parsed.satNumber : '';
  }

  /**
   * Resolves the DID to a DID Document
   * @param options - Resolution options
   * @returns The DID resolution result
   */
  async resolve(options: RequestInit = {}): Promise<DidResolutionResult> {
    try {
      const path = `1.0/did/${this.didString}`;
      const result = await this.apiClient.get<DidResolutionResult>(path, options);
      return result;
    } catch (error: any) {
      // Handle specific error cases
      if (error.error === ERROR_CODES.RESOURCE_NOT_FOUND) {
        return {
          didDocument: null,
          didResolutionMetadata: {
            error: ERROR_CODES.RESOURCE_NOT_FOUND,
            message: `DID not found: ${this.didString}`
          },
          didDocumentMetadata: {}
        };
      }
      
      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Deactivates a DID (creates a deactivation inscription)
   * This is a placeholder for a real implementation that would handle key management
   * and transaction signing
   * @returns The result of the deactivation operation
   */
  async deactivate(): Promise<{ success: boolean; txid?: string; error?: string }> {
    // This would typically involve:
    // 1. Creating a new DID document with deactivated: true
    // 2. Signing it with the appropriate key
    // 3. Creating a Bitcoin transaction with the inscription
    // 4. Broadcasting the transaction
    
    throw {
      error: 'NotImplemented',
      message: 'Deactivate method is not implemented yet'
    };
  }

  /**
   * Updates a DID document (creates an update inscription)
   * This is a placeholder for a real implementation that would handle key management
   * and transaction signing
   * @param document - The new DID document
   * @returns The result of the update operation
   */
  async update(document: DidDocument): Promise<{ success: boolean; txid?: string; error?: string }> {
    try {
      // Validate the document
      if (!document.id || !document['@context']) {
        return { success: false, error: 'Invalid DID document' };
      }
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
} 