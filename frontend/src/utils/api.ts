// Shared API client configuration
// Uses VITE_API_URL environment variable for base URL

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL;

if (!API_BASE_URL) {
  throw new Error(
    'VITE_API_URL environment variable is not set. ' +
    'Please create a .env file based on .env.example and set VITE_API_URL.'
  );
}

// Ensure the base URL doesn't end with a slash
const BASE_URL = API_BASE_URL.replace(/\/$/, '');

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  public async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        credentials: 'include', // Include cookies for session management
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      let data: T | undefined;
      let error: string | undefined;

      try {
        const responseText = await response.text();
        if (responseText) {
          data = JSON.parse(responseText);
        }
      } catch (parseError) {
        // If response is not JSON, treat it as an error message
        if (!response.ok) {
          error = 'Invalid response from server';
        }
      }

      if (!response.ok) {
        error = error || data as string || `Request failed: ${response.statusText}`;
        return {
          error,
          status: response.status,
        };
      }

      return {
        data,
        status: response.status,
      };
    } catch (networkError) {
      return {
        error: `Network error: ${networkError instanceof Error ? networkError.message : 'Unknown error'}`,
        status: 0,
      };
    }
  }

  async get<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export a default instance
export const apiClient = new ApiClient();

// Export the base URL for components that need it directly
export { BASE_URL };