import { useState, useEffect } from 'react';
import fetchClient from '../utils/fetchUtils';
import { env } from '../config/envConfig';

/**
 * Hook for retrieving user DIDs
 * @returns Object containing user DIDs and loading state
 */
export const useUserDids = () => {
  const [userDids, setUserDids] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchUserDids = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Get the API base URL from environment
        const apiBaseUrl = env.VITE_BACKEND_URL || 'http://localhost:3001/api';
        
        // Get auth token from local storage
        const token = localStorage.getItem('authToken');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        
        // Fetch user DIDs from the API
        const response = await fetchClient.get(`${apiBaseUrl}/user/dids`, { headers });
        
        if (response.data && Array.isArray(response.data.dids)) {
          setUserDids(response.data.dids);
        } else {
          // For development/testing, provide some mock DIDs if the API doesn't return any
          setUserDids([
            'did:btc:1234567890abcdef',
            'did:btc:abcdef1234567890'
          ]);
        }
      } catch (err: any) {
        console.error('Error fetching user DIDs:', err);
        setError(err.message || 'Failed to fetch user DIDs');
        
        // For development/testing, provide some mock DIDs if the API fails
        setUserDids([
          'did:btc:1234567890abcdef',
          'did:btc:abcdef1234567890'
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserDids();
  }, []);
  
  return { userDids, isLoading, error };
};

export default useUserDids;
