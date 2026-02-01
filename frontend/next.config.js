/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ionic/react', '@ionic/core', '@stencil/core'],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      crypto: false,
      stream: false,
      assert: false,
      http: false,
      https: false,
      os: false,
      url: false,
      path: false,
      zlib: false,
      querystring: false,
      util: false,
      buffer: false,
      net: false,
      tls: false,
      child_process: false,
      cluster: false,
      dgram: false,
      dns: false,
      events: false,
      punycode: false,
      readline: false,
      repl: false,
      tty: false,
      v8: false,
      vm: false,
    };

    return config;
  },
  ...(process.env.CAPACITOR_BUILD === 'true' && {
    output: 'export',
    distDir: 'dist',
    trailingSlash: true,
    images: {
      unoptimized: true,
    },
  }),
};

module.exports = nextConfig;