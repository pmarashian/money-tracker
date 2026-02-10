import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRequestOrigin, isAllowedOrigin } from "@/lib/cors";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, _next, and other Next.js internals
  if (
    pathname.startsWith("/_next/") ||
    pathname.includes(".") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/assets/")
  ) {
    return NextResponse.next();
  }

  const origin = getRequestOrigin(request);
  const allowed = isAllowedOrigin(request);

  if (request.method === "OPTIONS") {
    const preflightResponse = new NextResponse(null, { status: 200 });
    if (allowed && origin) {
      preflightResponse.headers.set("Access-Control-Allow-Origin", origin);
      preflightResponse.headers.set("Access-Control-Allow-Credentials", "true");
    }
    preflightResponse.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
    );
    preflightResponse.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );

    return preflightResponse;
  }

  const response = NextResponse.next();
  response.headers.set("X-Debug-Origin", origin ?? "none");
  response.headers.set("X-Debug-Allowed", String(allowed));
  if (allowed && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }
  response.headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD"
  );
  response.headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
