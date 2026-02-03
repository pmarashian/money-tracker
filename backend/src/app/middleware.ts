import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

// Define protected routes that require authentication
const protectedRoutes: string[] = [
  // Add protected API routes here as needed
  // Example: '/api/transactions',
  // Example: '/api/settings',
];

// Define public auth routes that should skip auth middleware
const publicAuthRoutes: string[] = [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/session', // Session endpoint should be publicly accessible to check auth status
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Handle authentication for protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    try {
      const user = await getSession(request);

      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Add user info to headers for downstream use
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', user.id);
      requestHeaders.set('x-user-email', user.email);

      // Continue with authenticated request
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Authentication error' },
        { status: 401 }
      );
    }
  }

  // Get allowed origins from environment variables
  const corsOrigin = process.env.CORS_ORIGIN;
  const corsProductionOrigin = process.env.CORS_PRODUCTION_ORIGIN;

  // Define allowed origins
  const allowedOrigins = [
    corsOrigin,
    corsProductionOrigin,
    // Add localhost variations for development
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ].filter(Boolean); // Remove undefined values

  // Check if the request origin is allowed
  const origin = request.headers.get('origin');
  const isAllowedOrigin = !origin || allowedOrigins.includes(origin);

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });

    if (isAllowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', origin || '*');
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Max-Age', '86400'); // 24 hours

    return response;
  }

  // Handle actual requests
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return response;
}

// Apply middleware to API routes
export const config = {
  matcher: '/api/:path*',
};