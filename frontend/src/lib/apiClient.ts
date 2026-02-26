import { getApiBaseUrl } from "./apiConfig";
import { getAuthToken, clearAuthToken } from "./authStorage";
import logger from "./logger";

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = getApiBaseUrl();
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
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

    // Get token from storage (async)
    const token = await getAuthToken();
    await logger.info("[API] Making request", {
      endpoint,
      method: options.method || "GET",
      hasToken: !!token,
      tokenLength: token?.length ?? 0,
    });

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, config);

      const result: ApiResponse<T> = {
        ok: response.ok,
        status: response.status,
      };

      // Clear token on 401 if we sent a token (meaning it's invalid)
      if (response.status === 401 && token) {
        await logger.warn(
          "[API] 401 Unauthorized response - token invalid, clearing",
          {
            endpoint,
            method: options.method || "GET",
            hadToken: true,
            tokenLength: token.length,
          },
        );
        await clearAuthToken();
      } else if (response.status === 401 && !token) {
        await logger.info(
          "[API] 401 Unauthorized response - no token was sent",
          {
            endpoint,
            method: options.method || "GET",
            hadToken: false,
          },
        );
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
              : (parsed?.message ?? "Request failed");
        }
      } catch {
        if (response.ok) result.data = text as unknown as T;
        else
          result.error =
            text || `Request failed with status ${response.status}`;
      }
      // await logger.info("[API] Request completed", {
      //   endpoint,
      //   method: options.method || "GET",
      //   status: result.status,
      //   ok: result.ok,
      //   hasError: !!result.error,
      // });

      return result;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Network error";
      await logger.error("[API] Request failed", {
        endpoint,
        method: options.method || "GET",
        error: errorMessage,
        errorStack: err instanceof Error ? err.stack : undefined,
        errorName: err instanceof Error ? err.name : undefined,
        hadToken: !!token,
        tokenLength: token?.length ?? 0,
      });

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
    data?: unknown,
  ): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, {
      method: "POST",
      body: data != null ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T = unknown>(
    endpoint: string,
    data?: unknown,
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
    options: RequestInit = {},
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
  options: RequestInit = {},
) => apiClient.request<T>(endpoint, options);
