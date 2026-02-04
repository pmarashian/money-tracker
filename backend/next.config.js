/** @type {import('next').NextConfig} */
const nextConfig = {
  // API-only app - disable pages optimization for API routes
  experimental: {
    appDir: true,
  },
  // Disable static optimization for API-only
  output: undefined,
}

module.exports = nextConfig