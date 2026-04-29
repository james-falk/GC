import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: [
    '@constructor/db',
    '@constructor/domain',
    '@constructor/pdf',
    '@constructor/ui',
  ],
};

export default nextConfig;
