import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Tell Next.js this monorepo root is the tracing root, not C:\Users\james
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // Promoted from experimental in Next 15.5
  typedRoutes: true,
  transpilePackages: [
    '@constructor/db',
    '@constructor/domain',
    '@constructor/pdf',
    '@constructor/ui',
  ],
};

export default nextConfig;
