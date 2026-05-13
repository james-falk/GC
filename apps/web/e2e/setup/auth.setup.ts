import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Interactive Clerk sign-in capture. Opens a real Chromium window, lets
// you sign in manually (handles Clerk's bot detection + email-OTP /
// password / passkey flow), then saves the session cookies + local
// storage to e2e/.auth/storage-state.json so every subsequent spec
// auto-authenticates.
//
// You only run this once per development machine, OR when the saved
// session expires (Clerk dev sessions last ~7 days). Re-run on expiry.
//
// Usage:
//   pnpm --filter @constructor/web test:e2e:auth-setup
//
// Then sign in in the browser that opens, navigate to /dashboard so the
// session is fully established, and press ENTER in this terminal.

const STORAGE_PATH = resolve('e2e/.auth/storage-state.json');
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';

async function main() {
  await mkdir(dirname(STORAGE_PATH), { recursive: true });

  console.log('\n=== Playwright auth capture ===\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Will save session to: ${STORAGE_PATH}\n`);
  console.log('Steps:');
  console.log('  1. A Chromium window will open in a moment.');
  console.log('  2. Sign in to your Clerk account.');
  console.log('  3. Make sure you reach /dashboard (or any authenticated page).');
  console.log('  4. Come back to this terminal and press ENTER.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });
  const context = await browser.newContext({
    viewport: null,
  });
  const page = await context.newPage();

  await page.goto(BASE_URL);

  // Wait for user to press ENTER.
  process.stdout.write('Press ENTER once you\'re signed in and on /dashboard... ');
  await new Promise<void>((res) => {
    const onData = () => {
      process.stdin.removeListener('data', onData);
      process.stdin.pause();
      res();
    };
    process.stdin.resume();
    process.stdin.once('data', onData);
  });

  // Sanity check: at least one Clerk cookie should be set.
  const cookies = await context.cookies();
  const clerkCookies = cookies.filter((c) =>
    c.name.startsWith('__session') || c.name.startsWith('__client'),
  );

  if (clerkCookies.length === 0) {
    console.error(
      '\n✗ No Clerk session cookies found. Did you actually sign in?',
    );
    console.error(
      '  Try again — sign in, navigate to /dashboard, then press ENTER.',
    );
    await browser.close();
    process.exit(1);
  }

  await context.storageState({ path: STORAGE_PATH });
  console.log(`\n✓ Saved Clerk session (${clerkCookies.length} cookies) to ${STORAGE_PATH}`);
  console.log('  You can now run: pnpm test:e2e:captions  or  pnpm test:e2e:narrate\n');

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error('\nAuth setup failed:', err);
  process.exit(1);
});
