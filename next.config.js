/** @type {import('next').NextConfig} */
const nextConfig = {
  // Traderra lives at ~/traderra but a stray ~/package-lock.json makes Next.js
  // infer ~ as the workspace root, breaking the final build-trace step
  // (ENOENT .../app/_not-found/page.js.nft.json). Pin the root explicitly.
  outputFileTracingRoot: __dirname,
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
    // baked at build start → changes every deploy; surfaced in the UI as a cache-freshness marker
    NEXT_PUBLIC_BUILD_AT: new Date().toISOString(),
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