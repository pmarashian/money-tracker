/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable middleware for API routes
    serverComponentsExternalPackages: [],
  },
  // Enable CORS headers for API routes
  async headers() {
    return [
      {
        // Apply to all API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.CORS_ORIGINS
              ? process.env.CORS_ORIGINS.split(',')[0] // Use first allowed origin as default
              : 'http://localhost:3001'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS, PATCH'
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig