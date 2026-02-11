import { getApiBaseUrl } from "./apiConfig";
import { useAuthStore } from "../store/authStore";
import logger from "./logger";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * Check if Zustand persist has finished hydrating from storage.
 * Returns true if hydrated, false if still hydrating.
 */
function isHydrated(): boolean {
  const persist = useAuthStore.persist;
  return persist?.hasHydrated?.() ?? false;
}

/**
 * Wait for Zustand persist to finish hydrating, with a timeout.
 * Returns true if hydrated successfully, false if timeout.
 */
async function waitForHydration(timeoutMs: number = 1000): Promise<boolean> {
  if (isHydrated()) {
    return true;
  }

  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkInterval = setInterval(() => {
      if (isHydrated()) {
        clearInterval(checkInterval);
        resolve(true);
      } else if (Date.now() - startTime > timeoutMs) {
        clearInterval(checkInterval);
        logger.warn('Hydration timeout: proceeding without waiting for token hydration');
        resolve(false);
      }
    }, 10);

    // Also listen for hydration event
    const persist = useAuthStore.persist;
    const unsub = persist?.onFinishHydration?.(() => {
      clearInterval(checkInterval);
      unsub?.();
      resolve(true);
    });
  });
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  /**
   * Get the auth token, ensuring hydration has completed first.
   * Returns null if no token exists.
   * 
   * Strategy:
   * 1. First check store state immediately (token might have been set synchronously after login)
   * 2. If no token and not hydrated, wait for hydration (to read from storage)
   * 3. After hydration (or timeout), check store state again
   */
  private async getTokenWithHydrationCheck(): Promise<string | null> {
    // First, check if token exists in store state immediately
    // This handles the case where token was just set (e.g., after login)
    // even if hydration hasn't completed yet
    let token = useAuthStore.getState().getToken();
    if (token) {
      logger.debug('[API] Token found in store state (immediate)');
      return token;
    }

    // If already hydrated, token doesn't exist
    if (isHydrated()) {
      logger.debug('[API] Store hydrated, no token found');
      return null;
    }

    // Not hydrated yet - wait for hydration to read from storage
    logger.debug('[API] Waiting for Zustand hydration before reading token...');
    const hydrated = await waitForHydration(1000);
    
    // After hydration (or timeout), check store state again
    // Even if hydration timed out, the token might now be available
    token = useAuthStore.getState().getToken();
    if (token) {
      logger.debug('[API] Token found after hydration check');
      return token;
    }

    if (!hydrated) {
      logger.warn('[API] Hydration incomplete and no token found');
    } else {
      logger.debug('[API] Store hydrated, no token found');
    }
    return null;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${path}`;

    const isFormData = options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (!isFormData && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    // Wait for hydration before reading token
    const token = await this.getTokenWithHydrationCheck();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      logger.debug(`${config.method || 'GET'}: ${url}`);

      const response = await fetch(url, config);

      const result: ApiResponse<T> = {
        ok: response.ok,
        status: response.status,
      };

      // Clear token on 401 if we sent a token (meaning it's invalid)
      // Don't clear if we didn't send a token (might be during initial hydration)
      if (response.status === 401 && token) {
        logger.info('[API] 401 response with token: clearing invalid token');
        useAuthStore.getState().clearToken();
      } else if (response.status === 401) {
        logger.debug('[API] 401 response without token (expected during initial load)');
      }

      const text = await response.text();

      if (!text) {
        if (response.ok) result.data = undefined as T;
        else result.error = "Request failed";
        return result;
      }

      try {
        const parsed = JSON.parse(text);
        if (response.ok) {
          result.data = parsed as T;
        } else {
          result.error =
            typeof parsed?.error === "string"
              ? parsed.error
              : parsed?.message ?? "Request failed";
        }
      } catch {
        if (response.ok) result.data = text as unknown as T;
        else
          result.error =
            text || `Request failed with status ${response.status}`;
      }
      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Network error";
      logger.error('[API] Request failed:', err);
      return {
        ok: false,
        status: 0,
        error: errorMessage,
      };
    }
  }

  async get<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: "GET" });
  }

  async post<T = unknown>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: "POST",
      body: data != null ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = unknown>(
    endpoint: string,
    data?: unknown
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: "PATCH",
      body: data != null ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = unknown>(endpoint: string): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { method: "DELETE" });
  }

  async request<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, options);
  }
}

export const apiClient = new ApiClient();

export const apiGet = <T = unknown>(endpoint: string) =>
  apiClient.get<T>(endpoint);
export const apiPost = <T = unknown>(endpoint: string, data?: unknown) =>
  apiClient.post<T>(endpoint, data);
export const apiPatch = <T = unknown>(endpoint: string, data?: unknown) =>
  apiClient.patch<T>(endpoint, data);
export const apiDelete = <T = unknown>(endpoint: string) =>
  apiClient.delete<T>(endpoint);
export const apiRequest = <T = unknown>(
  endpoint: string,
  options: RequestInit = {}
) => apiClient.request<T>(endpoint, options);
