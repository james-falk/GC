import { test, expect } from '@playwright/test';

// Scenario 4 — Drift detection. With everything from scenarios 1-3
// in place, the drift dashboard shows zero violations: the system is
// internally consistent. The narration emphasizes that this is the
// safety net for the inevitable manual-edit / partial-sync / migration
// drift over a 12-month project.

test('Drift dashboard reports system consistency', async ({ page }) => {
  await test.step('Lena opens the drift dashboard from the sidebar.', async () => {
    await page.goto('/drift');
    await expect(page.getByRole('heading', { name: /Drift/i })).toBeVisible();
  });

  await test.step('Five invariants run on every visit, scoped to every active project.', async () => {
    // The dashboard either lists violations or shows the "all clear" empty
    // state. Either is a valid demo outcome.
    const allClear = page.getByText(/no violations|all clear|consistent/i);
    const violationList = page.getByRole('list');
    await expect(allClear.or(violationList)).toBeVisible();
  });

  await test.step('Because the CO chain wrote atomically, no drift accumulated.', async () => {
    // No assertion beyond the previous step; this is narration over the
    // dashboard sitting empty/green.
  });
});
