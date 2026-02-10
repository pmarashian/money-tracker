import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const CAPACITOR_ORIGINS = ["capacitor://localhost", "ionic://localhost"];

/**
 * Allowed CORS origins. Env CORS_ORIGINS is merged with Capacitor origins
 * so that iOS/Android app WebViews work without extra config.
 */
export function getCorsAllowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : [
        "http://localhost:3001",
        "https://your-production-domain.com",
      ];
  const combined = [...fromEnv, ...CAPACITOR_ORIGINS];
  return Array.from(new Set(combined));
}

export function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return getCorsAllowedOrigins().includes(origin);
}

export function getRequestOrigin(request: NextRequest): string | null {
  return request.headers.get("origin");
}

/**
 * Set CORS headers on a response so the browser accepts it when using credentials.
 * Use in API routes so the response Allow-Origin matches the request origin (required for credentials).
 */
export function setCorsHeaders(
  response: NextResponse,
  request: NextRequest
): void {
  const origin = getRequestOrigin(request);
  if (origin && isAllowedOrigin(request)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
}
