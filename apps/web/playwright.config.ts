import { defineConfig, devices } from '@playwright/test';

// Playwright config for the constructor demo + smoke tests.
//
// Behaviors that matter for the recorded-demo pipeline:
//   - video: 'on' records every test for narration overlay
//   - trace: 'on' keeps timeline + screenshots for debug
//   - launchOptions.slowMo paces every action so narration audio has
//     room to breathe (typical narration line is ~3-4 seconds spoken;
//     a click in 0.2s would cause audio bleed)
//   - storageState loads the Clerk session saved by auth.setup.ts
//   - reporter outputs JSON so narrate-captions.mjs + narrate.ts can
//     read step timestamps after a run
//
// Scripts:
//   pnpm test:e2e               headless full run
//   pnpm test:e2e:headed        visible browser, same pace
//   pnpm test:e2e:auth-setup    one-time interactive sign-in (you do this)
//   pnpm test:e2e:captions      headless + caption-overlay MP4s (no audio)
//   pnpm test:e2e:narrate       headless + ElevenLabs audio + ffmpeg overlay

const SLOWMO_MS = Number(process.env.E2E_SLOWMO_MS ?? 1200);

export default defineConfig({
  testDir: './e2e/specs',

  // Each spec is a story; running them in parallel would interleave
  // their data and ruin the recordings.
  fullyParallel: false,
  workers: 1,

  // No retries — magic-links are single-use, retrying would consume a
  // dead link and fail. Surface failures immediately so we fix them.
  retries: 0,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e/playwright-report', open: 'never' }],
    ['json', { outputFile: 'e2e/test-results/results.json' }],
  ],

  outputDir: 'e2e/test-results/artifacts',

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3001',
    trace: 'on',
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    screenshot: 'only-on-failure',
    storageState: 'e2e/.auth/storage-state.json',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    viewport: { width: 1440, height: 900 },

    // Pace every action so a future narration overlay isn't faster
    // than the spoken line. Tunable via env var per-run.
    launchOptions: {
      slowMo: SLOWMO_MS,
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
