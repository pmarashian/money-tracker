/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [],
  },
  // CORS is handled by middleware and route-level setCorsHeaders (lib/cors.ts)
  // so we can reflect the request origin. Static headers here would override that
  // with a single origin and break Capacitor / multi-origin.
}

module.exports = nextConfig;