import { DEFAULT_API_ENDPOINT, DEFAULT_TIMEOUT, ERROR_CODES } from './constants';
import { ApiOptions, Fetch, ResourceError } from '../types';

/**
 * API client for interacting with Ordinals API endpoints
 */
export class ApiClient {
  private endpoint: string;
  private fetchFn: Fetch;
  private timeout: number;

  /**
   * Creates a new API client
   * @param options - Configuration options for the API client
   */
  constructor(options: ApiOptions = {}) {
    this.endpoint = options.endpoint || DEFAULT_API_ENDPOINT;
    this.fetchFn = options.fetch || fetch;  // Use native fetch by default
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
  }

  /**
   * Sends a GET request to the specified URL
   * @param path - The API path to request
   * @param options - Additional fetch options
   * @returns The response data
   */
  async get<T>(path: string, options: RequestInit = {}): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * Sends a POST request to the specified URL
   * @param path - The API path to request
   * @param body - The request body
   * @param options - Additional fetch options
   * @returns The response data
   */
  async post<T>(path: string, body: any, options: RequestInit = {}): Promise<T> {
    const requestOptions: RequestInit = {
      ...options,
      body: typeof body === 'string' ? body : JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    return this.request<T>('POST', path, requestOptions);
  }

  /**
   * Sends a request to the specified URL
   * @param method - The HTTP method to use
   * @param path - The API path to request
   * @param options - Additional fetch options
   * @returns The response data
   */
  private async request<T>(method: string, path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.endpoint}/${path}`;
    
    // Prepare the fetch options
    const fetchOptions: RequestInit = {
      method,
      ...options,
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
    };

    // Create an AbortController to handle timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const response = await this.fetchFn(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      // Clear the timeout
      clearTimeout(timeoutId);

      // Handle API errors
      if (!response.ok) {
        try {
          const errorData = await response.json() as ResourceError;
          throw {
            error: errorData.error || ERROR_CODES.UNEXPECTED_ERROR,
            message: errorData.message || `Request failed with status ${response.status}`,
            details: errorData.details || { status: response.status },
          };
        } catch (e) {
          // If parsing the error response fails, throw a generic error
          throw {
            error: ERROR_CODES.UNEXPECTED_ERROR,
            message: `Request failed with status ${response.status}`,
            details: { status: response.status },
          };
        }
      }

      // Check the content type to determine how to parse the response
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return response.json();
      } else {
        // If not JSON, return the raw response
        return response.text() as unknown as T;
      }
    } catch (error: unknown) {
      // Clear the timeout since the request completed or failed
      clearTimeout(timeoutId);
      
      // Handle abort errors (timeouts)
      if (error instanceof Error && error.name === 'AbortError') {
        return Promise.reject({
          error: ERROR_CODES.TIMEOUT,
          message: `Request timed out after ${this.timeout}ms`
        });
      }
      
      // Handle API errors
      if (typeof error === 'object' && error !== null) {
        const apiError = error as { error?: unknown; message?: string };
        if (apiError.error && apiError.message) {
          return Promise.reject({
            error: apiError.error,
            message: apiError.message
          });
        }
      }
      
      // Handle all other errors
      return Promise.reject({
        error: ERROR_CODES.NETWORK_ERROR,
        message: error instanceof Error ? error.message : 'Network request failed'
      });
    }
  }
} 