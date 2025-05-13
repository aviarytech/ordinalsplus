import { ERROR_CODES } from './constants';

export interface FetchOptions {
    headers?: Record<string, string>;
    timeout?: number;
}

export interface FetchResponse<T> {
    ok: boolean;
    status: number;
    data: T;
}

export async function fetchWithTimeout<T>(
    url: string,
    options: FetchOptions = {}
): Promise<FetchResponse<T>> {
    const { headers = {}, timeout = 5000 } = options;
    
    try {
        const response = await fetch(url, {
            headers,
            signal: AbortSignal.timeout(timeout)
        });

        if (!response.ok) {
            throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed with status ${response.status}`);
        }

        const data = await response.json();
        return {
            ok: true,
            status: response.status,
            data: data as T
        };
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`${ERROR_CODES.NETWORK_ERROR}: Request failed`);
    }
} 