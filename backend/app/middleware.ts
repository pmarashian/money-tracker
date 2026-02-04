import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Get allowed origins from environment or use defaults
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [
        'http://localhost:3001', // frontend dev server
        'https://your-production-domain.com' // replace with actual production URL
      ]

  const origin = request.headers.get('origin')
  const isAllowedOrigin = origin && allowedOrigins.includes(origin)

  // Create response
  const response = NextResponse.next()

  // Set CORS headers for all requests
  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Credentials', 'true')
  }

  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')

  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const preflightResponse = new NextResponse(null, { status: 200 })
    if (isAllowedOrigin) {
      preflightResponse.headers.set('Access-Control-Allow-Origin', origin)
      preflightResponse.headers.set('Access-Control-Allow-Credentials', 'true')
    }
    preflightResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
    preflightResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    return preflightResponse
  }

  return response
}

export const config = {
  matcher: '/api/:path*',
}