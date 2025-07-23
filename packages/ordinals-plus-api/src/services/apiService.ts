/**
 * API Service
 * 
 * This service handles API requests to external services.
 */
import { logger } from '../utils/logger';
import { env } from '../config/envConfig';

/**
 * Response from an API request
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

/**
 * Service for making API requests
 */
export class ApiService {
  /**
   * Base URL for API requests
   */
  private baseUrl: string;

  /**
   * Create a new API service
   * 
   * @param baseUrl - Base URL for API requests
   */
  constructor(baseUrl: string = env.API_BASE_URL || 'https://api.ordinalsplus.com') {
    this.baseUrl = baseUrl;
  }

  /**
   * Make a GET request
   * 
   * @param path - Request path
   * @param headers - Request headers
   * @returns Promise resolving to response
   */
  async get<T = any>(path: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, headers);
  }

  /**
   * Make a POST request
   * 
   * @param path - Request path
   * @param body - Request body
   * @param headers - Request headers
   * @returns Promise resolving to response
   */
  async post<T = any>(path: string, body?: any, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, headers);
  }

  /**
   * Make a PUT request
   * 
   * @param path - Request path
   * @param body - Request body
   * @param headers - Request headers
   * @returns Promise resolving to response
   */
  async put<T = any>(path: string, body?: any, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, headers);
  }

  /**
   * Make a DELETE request
   * 
   * @param path - Request path
   * @param headers - Request headers
   * @returns Promise resolving to response
   */
  async delete<T = any>(path: string, headers: Record<string, string> = {}): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, headers);
  }

  /**
   * Make an API request
   * 
   * @param method - HTTP method
   * @param path - Request path
   * @param body - Request body
   * @param headers - Request headers
   * @returns Promise resolving to response
   */
  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path);
    
    logger.debug(`API ${method} request to ${url}`);
    
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    };
    
    try {
      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: body ? JSON.stringify(body) : undefined
      });
      
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });
      
      const data = await response.json() as T;
      
      return {
        data,
        status: response.status,
        headers: responseHeaders
      };
    } catch (error) {
      logger.error(`API request failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build a URL from a path
   * 
   * @param path - Request path
   * @returns Full URL
   */
  private buildUrl(path: string): string {
    // Ensure path starts with a slash
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    
    return `${this.baseUrl}${path}`;
  }
}

export default ApiService;
