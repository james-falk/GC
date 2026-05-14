import { test, expect } from '@playwright/test';

// Scenario 6 — Mistakes are recoverable. Soft-delete on projects, plus
// cancel-with-reason on COs and sub pay-apps. Brief, capstone scenario:
// shows the safety net for real-world ops where someone clicks the
// wrong button and the demo gods chuckle.
//
// Selector notes:
//   - Project create needs adequate timeout (30s) since Next.js dev
//     compiles the new /projects/<uuid> route on first hit.
//   - The /projects list page does NOT render a per-row Restore button —
//     Restore only lives on the archived project's detail layout. The
//     "She restores it" step navigates into the archived project's
//     detail page (which is reachable from the showArchived view) and
//     clicks the layout's "Restore project" button.
//   - CO cancel-with-reason is in the per-project CO list (the global
//     /change-orders page has no cancel UI). We point at scenario 1's
//     Lincoln Elementary project so the spec can find COs to inspect.

test('Recovery: archive, restore, and cancel-with-reason', async ({ page }) => {
  await test.step('Lena spins up a quick throwaway project to demonstrate archive and restore.', async () => {
    await page.goto('/projects/new');
    await expect(
      page.getByRole('heading', { name: /new project/i }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/project number/i).fill('THROWAWAY-1');
    await page.getByLabel('Name', { exact: true }).fill('Demo throwaway');
    await page
      .getByLabel(/original contract amount/i)
      .fill('100000.00');
    await page.getByRole('button', { name: /create project/i }).click();

    // The redirect lands on /projects/<uuid> which compiles a new route
    // — needs the longer timeout we use for create flows.
    await expect(
      page.getByRole('heading', { name: 'Demo throwaway' }),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step('She archives it from the project header.', async () => {
    // The project-layout header renders Edit + Archive when !isArchived.
    // The throwaway project has no sworn-statement view open, so the
    // header's "Archive" is the only one in the DOM.
    await page.getByRole('button', { name: /^Archive$/ }).click();
    // archiveProject redirects to /projects (the list). Active list
    // hides archived rows by default; we land on the Projects heading.
    await expect(page).toHaveURL(/\/projects\/?$/, { timeout: 15_000 });
    await expect(
      page.getByRole('heading', { name: /^Projects$/ }),
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step('The archived project disappears — but it isn\'t gone.', async () => {
    await page.goto('/projects?showArchived=true');
    await expect(
      page.getByRole('link', { name: /Demo throwaway/ }).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step('She restores it. The project comes back, untouched.', async () => {
    // Navigate into the archived project — Restore lives on its detail
    // layout header (the "Restore project" button inside the amber
    // archived banner). The /projects list page itself has no Restore.
    await page
      .getByRole('link', { name: /Demo throwaway/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Demo throwaway' }),
    ).toBeVisible({ timeout: 30_000 });
    // The archived banner shows "Restore project" — match by accessible
    // button name.
    await page.getByRole('button', { name: /restore project/i }).click();
    // restoreProject redirects to /projects/<id>; the archived banner is
    // gone and the regular Edit/Archive header buttons return.
    await expect(
      page.getByRole('button', { name: /^Archive$/ }),
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step('Same safety net for change orders. She cancels a CO with a reason.', async () => {
    // Hop to scenario 1's Lincoln Elementary CO list — it's where the
    // cancel <details> is rendered. The global /change-orders page is a
    // read-only queue with no inline cancel.
    await page.goto('/projects');
    await page
      .getByRole('link', { name: /Lincoln Elementary/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Lincoln Elementary Renovation Phase 2' }),
    ).toBeVisible({ timeout: 30_000 });
    const projectUrl = page.url();
    await page.goto(`${projectUrl}/change-orders`);
    await expect(
      page.getByRole('heading', { name: /change orders/i }).first(),
    ).toBeVisible({ timeout: 15_000 });

    // The cancel UI is a <details><summary>cancel</summary>...</details>
    // rendered for any non-approved, non-cancelled CO. If none exist (all
    // approved or no COs at all), the narration still plays — we treat
    // this as a best-effort beat.
    const firstDetails = page
      .locator('details')
      .filter({ has: page.locator('summary', { hasText: /^cancel$/i }) })
      .first();
    if (await firstDetails.isVisible().catch(() => false)) {
      await firstDetails.locator('summary').click();
      await firstDetails
        .getByPlaceholder(/reason/i)
        .fill('Demo cancellation');
      await firstDetails
        .getByRole('button', { name: /cancel co/i })
        .click();
      // After cancel, the status badge in this row reads 'cancelled'.
      await expect(page.getByText(/cancelled/i).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  await test.step('Soft delete, cancel-with-reason, full audit trail. Nothing is lost.', async () => {
    // Narration-only closing beat. Re-assert the CO list heading so the
    // step has a deterministic body for the JSON reporter.
    await expect(
      page.getByRole('heading', { name: /change orders/i }).first(),
    ).toBeVisible();
  });
});
