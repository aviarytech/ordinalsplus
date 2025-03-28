const API_BASE_URL = typeof window !== 'undefined' 
  ? (window as any).__NEXT_DATA__?.props?.env?.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  : 'http://localhost:3000';

class ApiClient {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`);
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }

  async post<T>(path: string, data: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`API request failed: ${response.statusText}`);
    }
    return response.json();
  }
}

export const apiClient = new ApiClient(); 