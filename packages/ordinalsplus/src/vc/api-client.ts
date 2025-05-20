/**
 * Aces VC API Client
 * 
 * This module provides a client for interacting with the Aces Verifiable Credential API,
 * implementing secure communication, authentication, and request/response handling.
 */

import { createFetchClient, FetchRequestConfig, FetchError } from '../utils/fetchUtils';
import { 
  VerifiableCredential, 
  AcesApiResponse,
  ProofType
} from './types';

/**
 * Configuration options for the Aces API Client
 */
export interface AcesApiClientConfig {
  /** Base URL for the Aces API */
  apiUrl: string;
  
  /** API key for authentication */
  apiKey: string;
  
  /** Default timeout for requests in milliseconds */
  timeout?: number;
  
  /** Whether to enable request retries */
  enableRetry?: boolean;
  
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Delay between retries in milliseconds */
  retryDelay?: number;
}

/**
 * Types of requests supported by the API client
 */
export enum AcesRequestType {
  ISSUE_CREDENTIAL = 'issueCredential',
  VERIFY_CREDENTIAL = 'verifyCredential',
  REVOKE_CREDENTIAL = 'revokeCredential',
  CHECK_STATUS = 'checkStatus'
}

/**
 * Parameters for issuing a credential
 */
export interface IssueCredentialParams {
  /** The credential to be issued */
  credential: Omit<VerifiableCredential, 'proof'>;
  
  /** DID of the issuer */
  issuerDid: string;
  
  /** Type of proof to generate */
  proofType?: ProofType;
  
  /** ID to use for the credential */
  credentialId?: string;
}

/**
 * Parameters for verifying a credential
 */
export interface VerifyCredentialParams {
  /** The credential to verify */
  credential: VerifiableCredential;
}

/**
 * Parameters for revoking a credential
 */
export interface RevokeCredentialParams {
  /** ID of the credential to revoke */
  credentialId: string;
  
  /** DID of the issuer */
  issuerDid: string;
  
  /** Reason for revocation */
  reason?: string;
}

/**
 * Parameters for checking credential status
 */
export interface CheckStatusParams {
  /** ID of the credential to check */
  credentialId: string;
}

/**
 * Client for interacting with the Aces VC API
 */
export class AcesApiClient {
  private client: ReturnType<typeof createFetchClient>;
  private config: AcesApiClientConfig;
  
  /**
   * Creates a new AcesApiClient
   * 
   * @param config - Configuration for the client
   */
  constructor(config: AcesApiClientConfig) {
    this.config = {
      timeout: 30000,
      enableRetry: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    
    const fetchConfig: FetchRequestConfig = {
      baseURL: this.config.apiUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    };
    
    this.client = createFetchClient(fetchConfig);
  }
  
  /**
   * Issues a new verifiable credential
   * 
   * @param params - Parameters for issuing the credential
   * @returns The issued credential
   */
  async issueCredential(params: IssueCredentialParams): Promise<VerifiableCredential> {
    try {
      const response = await this.executeRequest(
        AcesRequestType.ISSUE_CREDENTIAL,
        params
      );
      
      return response.credential;
    } catch (error) {
      this.handleApiError(error, 'Error issuing credential');
      throw error; // Will be re-thrown after handling
    }
  }
  
  /**
   * Verifies a credential's authenticity
   * 
   * @param params - Parameters for verifying the credential
   * @returns Whether the credential is valid
   */
  async verifyCredential(params: VerifyCredentialParams): Promise<boolean> {
    try {
      const response = await this.executeRequest(
        AcesRequestType.VERIFY_CREDENTIAL,
        params
      );
      
      return response.status === 'success';
    } catch (error) {
      this.handleApiError(error, 'Error verifying credential');
      return false;
    }
  }
  
  /**
   * Revokes a previously issued credential
   * 
   * @param params - Parameters for revoking the credential
   * @returns Whether the revocation was successful
   */
  async revokeCredential(params: RevokeCredentialParams): Promise<boolean> {
    try {
      const response = await this.executeRequest(
        AcesRequestType.REVOKE_CREDENTIAL,
        params
      );
      
      return response.status === 'success';
    } catch (error) {
      this.handleApiError(error, 'Error revoking credential');
      throw error;
    }
  }
  
  /**
   * Checks the status of a credential
   * 
   * @param params - Parameters for checking credential status
   * @returns Status information about the credential
   */
  async checkCredentialStatus(params: CheckStatusParams): Promise<{
    active: boolean;
    revokedAt?: string;
    revocationReason?: string;
  }> {
    try {
      const response = await this.executeRequest(
        AcesRequestType.CHECK_STATUS,
        params
      );
      
      if (response.status === 'success') {
        return response.credential.credentialStatus as any;
      } else {
        throw new Error(`Error checking credential status: ${response.message}`);
      }
    } catch (error) {
      this.handleApiError(error, 'Error checking credential status');
      throw error;
    }
  }
  
  /**
   * Executes a request to the Aces API
   * 
   * @param requestType - Type of request
   * @param params - Request parameters
   * @returns API response
   */
  private async executeRequest(
    requestType: AcesRequestType,
    params: any
  ): Promise<AcesApiResponse> {
    const endpoint = this.getEndpoint(requestType);
    let attempt = 0;
    
    while (attempt <= (this.config.enableRetry ? this.config.maxRetries! : 0)) {
      try {
        const response = await this.client.post(endpoint, params);
        
        if (!response.data) {
          throw new Error('Empty response received from API');
        }
        
        return response.data as AcesApiResponse;
      } catch (error) {
        attempt++;
        
        // Handle retryable errors
        if (
          this.config.enableRetry &&
          attempt <= this.config.maxRetries! &&
          this.isRetryableError(error)
        ) {
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          continue;
        }
        
        // If we get here, either retries are disabled, we've exhausted our retries,
        // or the error is not retryable
        throw error;
      }
    }
    
    // This should never be reached due to the throw in the catch block
    throw new Error(`Request failed after ${attempt} attempts`);
  }
  
  /**
   * Gets the API endpoint for a request type
   * 
   * @param requestType - Type of request
   * @returns Endpoint URL
   */
  private getEndpoint(requestType: AcesRequestType): string {
    switch (requestType) {
      case AcesRequestType.ISSUE_CREDENTIAL:
        return '/v1/issueCredential';
      case AcesRequestType.VERIFY_CREDENTIAL:
        return '/v1/verifyCredential';
      case AcesRequestType.REVOKE_CREDENTIAL:
        return '/v1/revokeCredential';
      case AcesRequestType.CHECK_STATUS:
        return '/v1/status';
      default:
        throw new Error(`Unknown request type: ${requestType}`);
    }
  }
  
  /**
   * Determines if an error is retryable
   * 
   * @param error - The error to check
   * @returns Whether the error is retryable
   */
  private isRetryableError(error: any): boolean {
    // Network errors and certain HTTP status codes are retryable
    if (this.client.isFetchError(error)) {
      const fetchError = error as FetchError;
      
      // Network errors
      if (fetchError.isNetworkError || !fetchError.response) {
        return true;
      }
      
      // Retryable status codes: 408 (Request Timeout), 429 (Too Many Requests),
      // 500, 502, 503, 504 (Server Errors)
      const status = fetchError.status || 0;
      return status === 408 || status === 429 || (status >= 500 && status <= 504);
    }
    
    // By default, don't retry
    return false;
  }
  
  /**
   * Handles API errors with proper logging
   * 
   * @param error - The error to handle
   * @param message - Message describing the operation
   */
  private handleApiError(error: any, message: string): void {
    if (this.client.isFetchError(error)) {
      const fetchError = error as FetchError;
      
      if (fetchError.response) {
        // API responded with an error status
        console.error(`${message}: ${fetchError.status} - ${JSON.stringify(fetchError.data)}`);
      } else if (fetchError.request) {
        // Request was made but no response received
        console.error(`${message}: No response received from API`, fetchError.request);
      } else {
        // Request setup error
        console.error(`${message}: Request setup error`, fetchError.message);
      }
    } else {
      // Non-fetch error
      console.error(`${message}: ${error.message || error}`);
    }
  }
} 