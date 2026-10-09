import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import {
  getCorsAllowedOrigins,
  isAllowedOrigin,
  isOriginAllowed,
} from "./cors";

function requestWithOrigin(origin: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/test", {
    headers: { origin },
  });
}

describe("CORS origin allowlist", () => {
  const prevCorsOrigins = process.env.CORS_ORIGINS;

  beforeEach(() => {
    delete process.env.CORS_ORIGINS;
  });

  afterEach(() => {
    if (prevCorsOrigins === undefined) {
      delete process.env.CORS_ORIGINS;
    } else {
      process.env.CORS_ORIGINS = prevCorsOrigins;
    }
  });

  it("includes Capacitor and Vercel production web origin in defaults", () => {
    const origins = getCorsAllowedOrigins();
    expect(origins).toContain("capacitor://localhost");
    expect(origins).toContain("ionic://localhost");
    expect(origins).toContain("https://money-tracker-web-ashy.vercel.app");
  });

  it("allows Vercel PR preview origins via pattern", () => {
    const preview =
      "https://money-tracker-web-git-feature-abc-phillip-marashians-projects.vercel.app";
    expect(isOriginAllowed(preview)).toBe(true);
    expect(isAllowedOrigin(requestWithOrigin(preview))).toBe(true);
  });

  it("rejects unrelated Vercel preview hostnames", () => {
    const other = "https://other-app-git-main-phillip-marashians-projects.vercel.app";
    expect(isOriginAllowed(other)).toBe(false);
    expect(isAllowedOrigin(requestWithOrigin(other))).toBe(false);
  });

  it("merges CORS_ORIGINS env with built-in origins", () => {
    process.env.CORS_ORIGINS = "https://custom.example.com";
    const origins = getCorsAllowedOrigins();
    expect(origins).toContain("https://custom.example.com");
    expect(origins).toContain("https://money-tracker-web-ashy.vercel.app");
    expect(isOriginAllowed("https://custom.example.com")).toBe(true);
  });
});
