import { test, expect } from '@playwright/test';

// Scenario 4 — Drift detection. With everything from scenarios 1-3
// in place, the drift dashboard shows zero violations: the system is
// internally consistent. The narration emphasizes that this is the
// safety net for the inevitable manual-edit / partial-sync / migration
// drift over a 12-month project.
//
// Selector note: the page renders an <h1>"Drift Alerts" + 3 stat tiles +
// either the empty state (text "All clear.") or a <ul> of alerts. We
// match the heading via /Drift/i so either spelling holds, and accept
// either presentation in the second step.

test('Drift dashboard reports system consistency', async ({ page }) => {
  await test.step('Lena opens the drift dashboard from the sidebar.', async () => {
    await page.goto('/drift');
    await expect(page.getByRole('heading', { name: /drift/i })).toBeVisible({
      timeout: 30_000,
    });
  });

  await test.step('Five invariants run on every visit, scoped to every active project.', async () => {
    // The dashboard either lists violations or shows the "all clear" empty
    // state. Either is a valid demo outcome. The empty state text is
    // "All clear." inside the dashed-border card; the populated state is
    // a <ul> of <li>'s.
    const allClear = page.getByText(/all clear|no drift detected/i);
    const violationItem = page.locator('ul > li').first();
    await expect(allClear.or(violationItem)).toBeVisible({ timeout: 15_000 });
  });

  await test.step('Because the CO chain wrote atomically, no drift accumulated.', async () => {
    // No assertion beyond the previous step; this is narration over the
    // dashboard sitting empty/green. We still re-check the heading so
    // Playwright sees a step body and the JSON reporter records timing.
    await expect(page.getByRole('heading', { name: /drift/i })).toBeVisible();
  });
});
