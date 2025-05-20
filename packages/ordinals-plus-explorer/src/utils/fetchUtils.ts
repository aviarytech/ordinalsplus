/**
 * Fetch Utilities
 * 
 * This module provides utilities for working with the Fetch API,
 * implementing similar functionality to axios with error handling,
 * request configuration, and response processing.
 */

// Error handling types
export interface FetchError extends Error {
  status?: number;
  response?: Response;
  data?: any;
  request?: Request;
  isNetworkError?: boolean;
}

// Request configuration types
export interface FetchRequestConfig {
  baseURL?: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  data?: any;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: 'json' | 'text' | 'arraybuffer' | 'blob';
}

// Response types
export interface FetchResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
  config: FetchRequestConfig;
  request?: Request;
}

/**
 * Creates a fetch client with similar API to axios
 */
export function createFetchClient(config: FetchRequestConfig = {}) {
  const defaultConfig: FetchRequestConfig = {
    baseURL: '',
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: 30000,
    ...config
  };

  /**
   * Helper to build the full URL including query parameters
   */
  const buildUrl = (urlPath: string, params?: Record<string, string>): string => {
    const baseUrl = defaultConfig.baseURL || '';
    const fullPath = urlPath.startsWith('http') ? urlPath : `${baseUrl}${urlPath}`;
    
    if (!params) return fullPath;
    
    const url = new URL(fullPath);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
    
    return url.toString();
  };

  /**
   * Helper to create a fetch request with timeout
   */
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<Response> => {
    const controller = new AbortController();
    const { signal } = controller;
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, { ...options, signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`) as FetchError;
        timeoutError.isNetworkError = true;
        throw timeoutError;
      }
      throw error;
    }
  };

  /**
   * Process the response and handle errors
   */
  const processResponse = async <T>(
    response: Response,
    request: Request,
    config: FetchRequestConfig
  ): Promise<FetchResponse<T>> => {
    let data: any;
    
    try {
      // Process response based on responseType or content-type
      const responseType = config.responseType;
      
      if (responseType === 'arraybuffer') {
        data = await response.arrayBuffer();
      } else if (responseType === 'blob') {
        data = await response.blob();
      } else if (responseType === 'text') {
        data = await response.text();
      } else if (responseType === 'json' || !responseType) {
        // Default to JSON if content-type suggests it, otherwise try text
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
      }
    } catch (error) {
      data = null;
    }
    
    if (!response.ok) {
      const fetchError = new Error(
        `Request failed with status ${response.status}: ${response.statusText}`
      ) as FetchError;
      
      fetchError.status = response.status;
      fetchError.response = response;
      fetchError.data = data;
      fetchError.request = request;
      
      throw fetchError;
    }
    
    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      config,
      request
    };
  };

  /**
   * Main request method
   */
  const request = async <T = any>(config: FetchRequestConfig): Promise<FetchResponse<T>> => {
    const mergedConfig = { ...defaultConfig, ...config };
    const { 
      url = '', 
      method = 'GET', 
      headers = {}, 
      params,
      data,
      timeout = defaultConfig.timeout
    } = mergedConfig;
    
    const fullUrl = buildUrl(url, params);
    
    const options: RequestInit = {
      method,
      headers: { ...defaultConfig.headers, ...headers }
    };
    
    // Add body for non-GET requests
    if (method !== 'GET' && data !== undefined) {
      options.body = typeof data === 'string' ? data : JSON.stringify(data);
    }
    
    try {
      const request = new Request(fullUrl, options);
      const response = await fetchWithTimeout(fullUrl, options, timeout || 30000);
      return await processResponse<T>(response, request, mergedConfig);
    } catch (error) {
      if (error instanceof Error) {
        const fetchError = error as FetchError;
        
        // Network errors don't have response
        if (!fetchError.response) {
          fetchError.isNetworkError = true;
        }
        
        throw fetchError;
      }
      throw error;
    }
  };

  // Create convenience methods for HTTP verbs
  const get = <T = any>(url: string, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return request<T>({ ...config, url, method: 'GET' });
  };
  
  const post = <T = any>(url: string, data?: any, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return request<T>({ ...config, url, method: 'POST', data });
  };
  
  const put = <T = any>(url: string, data?: any, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return request<T>({ ...config, url, method: 'PUT', data });
  };
  
  const patch = <T = any>(url: string, data?: any, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return request<T>({ ...config, url, method: 'PATCH', data });
  };
  
  const del = <T = any>(url: string, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return request<T>({ ...config, url, method: 'DELETE' });
  };

  // Helper to check if an error is a fetch error
  const isFetchError = (error: any): error is FetchError => {
    return error && typeof error === 'object' && 'isNetworkError' in error;
  };

  return {
    request,
    get,
    post,
    put,
    patch,
    delete: del,
    create: (config: FetchRequestConfig) => createFetchClient({ ...defaultConfig, ...config }),
    isFetchError
  };
}

// Create a default fetch client instance
const fetchClient = createFetchClient();
export default fetchClient;
