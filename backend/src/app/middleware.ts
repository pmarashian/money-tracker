import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
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