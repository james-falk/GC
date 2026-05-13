import { defineConfig } from 'vitest/config';

// Vitest config for unit tests living under src/. The Playwright e2e
// specs (apps/web/e2e/**) use Playwright's own runner — exclude them
// here or vitest tries to load them and crashes on the @playwright/test
// import (which expects Playwright's worker context, not vitest's).

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', 'node_modules/**', '.next/**'],
    passWithNoTests: true,
  },
});
