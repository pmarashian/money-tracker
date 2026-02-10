/**
 * Configuration for API base URLs.
 * Returns the correct base URL for API calls depending on the environment.
 */

import { Capacitor } from "@capacitor/core";

const DEFAULT_DEV = "http://localhost:3000";
const DEFAULT_PROD = "https://money-tracker-backend-wine.vercel.app";

/**
 * Get the API base URL for making API calls.
 * - VITE_API_URL env overrides when set.
 * - In Capacitor (iOS simulator or device), always use deployed backend (localhost on device is not your machine).
 * - Web: dev uses localhost, prod uses DEFAULT_PROD.
 */
export function getApiBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_API_URL;

  console.log("fromEnv", fromEnv);

  if (fromEnv && typeof fromEnv === "string") {
    console.log("fromEnv is string", fromEnv);
    return fromEnv.replace(/\/$/, "");
  }

  if (Capacitor.isNativePlatform()) {
    console.log("isNativePlatform");
    const prodUrl = import.meta.env.VITE_PROD_API_URL ?? DEFAULT_PROD;

    console.log("prodUrl", prodUrl);

    return (typeof prodUrl === "string" ? prodUrl : DEFAULT_PROD).replace(
      /\/$/,
      ""
    );
  }

  const apiUrl = import.meta.env.DEV ? DEFAULT_DEV : DEFAULT_PROD;

  console.log("apiUrl", apiUrl);

  return apiUrl;
}

/**
 * Get the full API URL for a given endpoint.
 */
export function getApiUrl(endpoint: string): string {
  const base = getApiBaseUrl();
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
}
