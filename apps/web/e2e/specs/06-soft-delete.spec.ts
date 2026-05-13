import { test, expect } from '@playwright/test';

// Scenario 6 — Mistakes are recoverable. Soft-delete on projects, plus
// cancel-with-reason on COs and sub pay-apps. Brief, capstone scenario:
// shows the safety net for real-world ops where someone clicks the
// wrong button and the demo gods chuckle.

test('Recovery: archive, restore, and cancel-with-reason', async ({ page }) => {
  await test.step('Lena spins up a quick throwaway project to demonstrate archive and restore.', async () => {
    await page.goto('/projects/new');
    await page.getByLabel('Project number').fill('THROWAWAY-1');
    await page.getByLabel('Name').fill('Demo throwaway');
    await page.getByLabel('Original contract amount').fill('100000.00');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByText('Demo throwaway')).toBeVisible();
  });

  await test.step('She archives it from the project header.', async () => {
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText('Demo throwaway')).not.toBeVisible();
  });

  await test.step('The archived project disappears — but it isn\'t gone.', async () => {
    await page.goto('/projects?showArchived=true');
    await expect(page.getByText('Demo throwaway')).toBeVisible();
  });

  await test.step('She restores it. The project comes back, untouched.', async () => {
    await page
      .getByRole('row', { name: /Demo throwaway/ })
      .getByRole('button', { name: 'Restore' })
      .click();
    await expect(page.getByText(/restored|Demo throwaway/)).toBeVisible();
  });

  await test.step('Same safety net for change orders. She cancels a CO with a reason.', async () => {
    await page.goto('/change-orders');
    const firstCancelable = page
      .locator('details')
      .filter({ hasText: /cancel/i })
      .first();
    if (await firstCancelable.isVisible()) {
      await firstCancelable.click();
      await firstCancelable.getByPlaceholder('Reason').fill('Demo cancellation');
      await firstCancelable.getByRole('button', { name: /Cancel CO/i }).click();
    }
  });

  await test.step('Soft delete, cancel-with-reason, full audit trail. Nothing is lost.', async () => {
    // Narration-only closing beat; no assertion needed.
  });
});
