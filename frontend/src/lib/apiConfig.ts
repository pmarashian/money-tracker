/**
 * Configuration for API base URLs.
 * Returns the correct base URL for API calls depending on the environment.
 */

import { Capacitor } from "@capacitor/core";

const DEFAULT_DEV = "http://localhost:3000";
const DEFAULT_PROD = "https://your-production-domain.com";

/**
 * Get the API base URL for making API calls.
 * Priority: VITE_API_URL env, then Capacitor native (dev/prod), then web dev/prod.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;
  if (fromEnv && typeof fromEnv === "string") {
    return fromEnv.replace(/\/$/, "");
  }

  if (Capacitor.isNativePlatform()) {
    return import.meta.env.DEV ? DEFAULT_DEV : DEFAULT_PROD;
  }

  return import.meta.env.DEV ? DEFAULT_DEV : DEFAULT_PROD;
}

/**
 * Get the full API URL for a given endpoint.
 */
export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}
