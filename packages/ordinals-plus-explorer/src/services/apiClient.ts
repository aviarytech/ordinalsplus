import { createFetchClient } from '../utils/fetchUtils';
import type { FetchRequestConfig, FetchResponse } from '../utils/fetchUtils';
import { env } from '../config/envConfig';

// Create a fetch client instance with default configuration
const baseApiClient = createFetchClient({
  baseURL: env.VITE_BACKEND_URL || 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Create a wrapper around the fetch client to add auth token handling
export const apiClient = {
  request: async <T = any>(config: FetchRequestConfig): Promise<FetchResponse<T>> => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    const headers = { ...config.headers };
    
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    try {
      return await baseApiClient.request<T>({ ...config, headers });
    } catch (error) {
      // Handle common error cases
      if (baseApiClient.isFetchError(error)) {
        if (error.response) {
          // Server responded with an error status
          console.error('API Error:', error.status, error.data);
          
          // Handle authentication errors
          if (error.status === 401) {
            // Clear auth data and redirect to login if needed
            localStorage.removeItem('authToken');
          }
        } else if (error.request) {
          // Request was made but no response received
          console.error('API Error: No response received', error.request);
        } else {
          // Error in setting up the request
          console.error('API Error:', error.message);
        }
      } else {
        console.error('API Error:', error instanceof Error ? error.message : 'Unknown error');
      }
      
      throw error;
    }
  },
  
  get: <T = any>(url: string, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return apiClient.request<T>({ ...config, url, method: 'GET' });
  },
  
  post: <T = any>(url: string, data?: any, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return apiClient.request<T>({ ...config, url, method: 'POST', data });
  },
  
  put: <T = any>(url: string, data?: any, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return apiClient.request<T>({ ...config, url, method: 'PUT', data });
  },
  
  patch: <T = any>(url: string, data?: any, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return apiClient.request<T>({ ...config, url, method: 'PATCH', data });
  },
  
  delete: <T = any>(url: string, config?: FetchRequestConfig): Promise<FetchResponse<T>> => {
    return apiClient.request<T>({ ...config, url, method: 'DELETE' });
  }
};
