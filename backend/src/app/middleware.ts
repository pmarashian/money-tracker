import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Clone the response
  const response = NextResponse.next();

  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  return response;
}

// Apply middleware to API routes
export const config = {
  matcher: '/api/:path*',
};