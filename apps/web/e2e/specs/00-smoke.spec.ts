import { test, expect } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Pre-flight check. Runs before every scenario spec to verify:
//   1. The storage-state file exists (else: run auth-setup)
//   2. The saved Clerk session still works (else: run auth-setup again)
//   3. The dashboard renders for the signed-in user
//
// Failing this spec means none of the scenario specs will work, so
// fail fast with a clear message.

const STORAGE_PATH = resolve('e2e/.auth/storage-state.json');

test.describe.configure({ mode: 'serial' });

test('storage-state file exists', async () => {
  if (!existsSync(STORAGE_PATH)) {
    throw new Error(
      `\n✗ ${STORAGE_PATH} not found.\n` +
        `  Run: pnpm --filter @constructor/web test:e2e:auth-setup\n` +
        `  Sign in in the browser that opens, then re-run this command.\n`,
    );
  }
});

test('signed-in user can reach the dashboard', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({
    timeout: 10_000,
  });
});

test('sidebar shows expected nav items', async ({ page }) => {
  await page.goto('/dashboard');
  // Scope to the sidebar so we don't match the dashboard's "Quick links"
  // cards (which use the same labels).
  const sidebar = page.locator('aside').first();
  await expect(sidebar.getByRole('link', { name: 'Projects' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Organizations' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Pay Apps' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Change Orders' })).toBeVisible();
});
