/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Dangerously allow production builds to successfully complete even if TypeScript errors are present
    ignoreBuildErrors: true,
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if ESLint errors are present
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['images.unsplash.com', 'avatars.githubusercontent.com'],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: 'http://localhost:6500/:path*',
      },
      {
        source: '/api/renata/:path*',
        destination: 'http://localhost:6500/api/renata/:path*',
      },
    ];
  },
  headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;