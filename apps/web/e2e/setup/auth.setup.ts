import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Interactive auth capture. Opens a real Chromium window pointed at the
// app, waits for you to sign in via Clerk, then saves the session to
// disk so subsequent test runs reuse it without re-prompting.
//
// Why a separate script (not a Playwright project): Playwright's
// global-setup pattern is great when you can run sign-in headlessly,
// but Clerk's sign-in flow has bot detection that often rejects
// automated drivers. Doing this once interactively avoids the whole
// arms race.
//
// Run: pnpm --filter @constructor/web test:e2e:auth-setup

const STORAGE_PATH = resolve('e2e/.auth/storage-state.json');
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

async function main() {
  await mkdir(dirname(STORAGE_PATH), { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log(`\nOpening ${BASE_URL} — please sign in manually.`);
  console.log(
    'Once you reach the dashboard (or any authenticated page), press ENTER in this terminal to save the session.\n',
  );

  await page.goto(BASE_URL);

  // Wait for user to confirm via stdin.
  await new Promise<void>((res) => {
    process.stdin.once('data', () => res());
    process.stdin.resume();
  });

  await context.storageState({ path: STORAGE_PATH });
  console.log(`\n✓ Saved authenticated session to ${STORAGE_PATH}`);

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('Auth setup failed:', err);
  process.exit(1);
});
