import { defineConfig, devices } from '@playwright/test';

// Playwright config for the constructor demo + smoke tests.
//
// Key behaviors:
//   - `video: 'on'` records every test as a webm we can later overlay
//     with ElevenLabs narration.
//   - `trace: 'on'` keeps the timeline + screenshots so test failures
//     are debuggable without re-running.
//   - storageState is loaded from e2e/.auth/storage-state.json (gitignored,
//     populated by `pnpm test:e2e:auth-setup`). Without it, every test
//     starts logged-out and the GC-side specs fail.
//
// `pnpm test:e2e` — headless run, suitable for CI or quick local
// `pnpm test:e2e:headed` — opens a real browser at human speed
// `pnpm test:e2e:auth-setup` — runs the one-time interactive sign-in
// `pnpm test:e2e:narrate` — runs tests then narrate.ts to produce MP4s

export default defineConfig({
  testDir: './e2e/specs',
  // Each spec is a story; running them in parallel would interleave
  // their data. Force serial to keep videos coherent.
  fullyParallel: false,
  workers: 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
    ['json', { outputFile: 'e2e/test-results/results.json' }],
  ],

  outputDir: 'e2e/test-results/artifacts',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on',
    video: 'on',
    screenshot: 'only-on-failure',
    storageState: 'e2e/.auth/storage-state.json',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
