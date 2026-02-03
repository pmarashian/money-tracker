import { NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  // Simple CORS headers for all requests
  const response = NextResponse.next();

  // Allow localhost:3001
  response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  return response;
}

// Apply middleware to all routes for testing
export const config = {
  matcher: '/:path*',
};