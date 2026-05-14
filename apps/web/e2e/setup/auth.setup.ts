import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

// Clerk sign-in capture. Opens a real Chromium window pointed at the
// app, then polls for Clerk session cookies. As soon as you finish
// signing in (cookies appear), the script auto-saves the session and
// exits — no need to press ENTER or babysit the terminal.
//
// You only run this once per development machine, OR when the saved
// session expires (Clerk dev sessions last ~7 days).
//
// Usage:
//   pnpm --filter @constructor/web test:e2e:auth-setup
//
// Sign in normally in the browser that opens. Navigate to /dashboard
// so the full session establishes. The script saves automatically.

const STORAGE_PATH = resolve('e2e/.auth/storage-state.json');
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3001';
const TIMEOUT_MS = 15 * 60 * 1000; // 15 min — patient for MFA / email OTP

async function main() {
  await mkdir(dirname(STORAGE_PATH), { recursive: true });

  console.log('\n=== Playwright auth capture ===\n');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Will save session to: ${STORAGE_PATH}\n`);
  console.log('A Chromium window is opening — sign in normally, then navigate');
  console.log('to /dashboard. The script auto-saves once it sees Clerk cookies.\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized'],
  });
  const context = await browser.newContext({
    viewport: null,
  });
  const page = await context.newPage();

  await page.goto(BASE_URL);

  console.log('Polling every 1s for Clerk session cookies (15min timeout)…');

  const startedAt = Date.now();
  let clerkCookies: Array<{ name: string }> = [];

  // Only __session counts as proof of sign-in. Clerk sets __client on
  // page load even for anonymous visitors (it's an anonymous tracking
  // cookie), so checking for it would false-positive on the landing page.
  while (Date.now() - startedAt < TIMEOUT_MS) {
    const cookies = await context.cookies();
    clerkCookies = cookies.filter((c) => c.name.startsWith('__session'));
    if (clerkCookies.length > 0) {
      console.log(
        `\n  Detected Clerk __session cookie. Waiting 3s for session to settle…`,
      );
      await new Promise((r) => setTimeout(r, 3000));
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (clerkCookies.length === 0) {
    console.error(
      '\n✗ Timed out without detecting a Clerk session. Either sign-in failed, or your Clerk instance uses different cookie names.',
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
