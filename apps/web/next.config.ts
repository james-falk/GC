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
  // Stop dev-mode HMR from reacting to test files. Playwright specs +
  // narration scripts under e2e/ get edited frequently during demo
  // recording; each edit was triggering a Fast Refresh full reload that
  // wedged in-flight Playwright runs.
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          ...(Array.isArray(config.watchOptions?.ignored)
            ? config.watchOptions.ignored
            : []),
          '**/e2e/**',
          '**/node_modules/**',
          '**/.next/**',
        ],
      };
    }
    return config;
  },
};

export default nextConfig;
