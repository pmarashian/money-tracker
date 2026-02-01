/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable static optimization since this is an API-only app
  experimental: {
    appDir: true,
  },
  // API-only app, no static export needed
  output: 'standalone',
  // CORS configuration
  async headers() {
    return [
      {
        // Apply to all API routes
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.CORS_ORIGIN || '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;