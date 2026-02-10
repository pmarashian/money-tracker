import { getApiBaseUrl } from "./apiConfig";
import { useAuthStore } from "../store/authStore";

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

    const token = useAuthStore.getState().getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
    };

    try {
      console.log(`${config.method}: ${url}`);

      const response = await fetch(url, config);

      const result: ApiResponse<T> = {
        ok: response.ok,
        status: response.status,
      };

      if (response.status === 401) {
        useAuthStore.getState().clearToken();
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
      return {
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : "Network error",
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
