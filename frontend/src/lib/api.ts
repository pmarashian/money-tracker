// API client for configurable backend communication
// Supports both web development and Capacitor/native builds

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Creates a full API URL by combining the base URL with the endpoint
 * @param endpoint - API endpoint (should start with /)
 * @returns Full API URL
 */
export function getApiUrl(endpoint: string): string {
  // Ensure endpoint starts with /
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Combine base URL with endpoint
  return `${API_BASE_URL}${normalizedEndpoint}`;
}

/**
 * Makes an API request with consistent configuration
 * @param endpoint - API endpoint (should start with /)
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Promise<Response>
 */
export async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = getApiUrl(endpoint);

  // Default options for all API requests
  const defaultOptions: RequestInit = {
    credentials: 'include', // Include cookies for session management
    headers: {
      // Only set Content-Type to application/json if not FormData
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  };

  // Merge with provided options
  const mergedOptions = { ...defaultOptions, ...options };

  return fetch(url, mergedOptions);
}

/**
 * Makes a GET request to the API
 * @param endpoint - API endpoint
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export function apiGet(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return apiRequest(endpoint, { ...options, method: 'GET' });
}

/**
 * Makes a POST request to the API
 * @param endpoint - API endpoint
 * @param data - Request body data
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export function apiPost(endpoint: string, data?: any, options: RequestInit = {}): Promise<Response> {
  const body = data ? JSON.stringify(data) : undefined;
  return apiRequest(endpoint, { ...options, method: 'POST', body });
}

/**
 * Makes a PATCH request to the API
 * @param endpoint - API endpoint
 * @param data - Request body data
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export function apiPatch(endpoint: string, data?: any, options: RequestInit = {}): Promise<Response> {
  const body = data ? JSON.stringify(data) : undefined;
  return apiRequest(endpoint, { ...options, method: 'PATCH', body });
}

/**
 * Makes a DELETE request to the API
 * @param endpoint - API endpoint
 * @param options - Additional fetch options
 * @returns Promise<Response>
 */
export function apiDelete(endpoint: string, options: RequestInit = {}): Promise<Response> {
  return apiRequest(endpoint, { ...options, method: 'DELETE' });
}