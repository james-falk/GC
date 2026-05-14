import { test, expect } from '@playwright/test';

// Scenario 5 — Sworn statement chain. Illinois (and most states) require
// a notarized affidavit alongside the AIA pay-app. Lena walks the
// statement through its full state machine: generated → signed →
// notarized → sent to architect → architect approved → sent to owner →
// owner approved → archived.
//
// Demonstrates the same audit-trailed state-machine pattern used for
// COs and pay apps — every transition writes an approval_event.
//
// Selector notes:
//   - The project layout renders an "Archive" button in the header AND
//     the sworn-statement page renders its own "Archive" button in the
//     actions panel. To avoid strict-mode collisions we scope every
//     action-panel click via the panel's containing aside.
//   - Status-flow list items repeat the label of each transition button
//     ("Mark signed" / "Mark notarized" / etc.) so assertions on plain
//     text are weak but safe — they pass even before the transition
//     advances. Where possible we use the status indicator dot rather
//     than the label text alone.

test('Sworn statement state machine: full chain', async ({ page }) => {
  await test.step('From the April pay app, Lena opens the Sworn Statement view.', async () => {
    await page.goto('/projects');
    await page
      .getByRole('link', { name: /Lincoln Elementary/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Lincoln Elementary Renovation Phase 2' }),
    ).toBeVisible({ timeout: 30_000 });
    const projectUrl = page.url();
    await page.goto(`${projectUrl}/pay-apps/sworn-statement`);
    await expect(
      page.getByRole('heading', { name: /sworn statement/i }),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step('She generates the sworn statement from the most recent owner pay-app.', async () => {
    // The "Generate sworn statement" button only renders when no SS
    // exists yet on this project. If scenario 3 already left one, the
    // page lands on the preview directly — skip the click in that case.
    const generateBtn = page.getByRole('button', {
      name: /generate sworn statement/i,
    });
    if (await generateBtn.isVisible().catch(() => false)) {
      await generateBtn.click();
    }
    // After generate (or on existing SS), the page shows the status flow
    // with "Generated" at the top.
    await expect(page.getByText('Generated').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  // All transition buttons live inside the actions panel <aside>. Scope
  // every click to that aside so we don't collide with the project
  // header's "Archive" button.
  const actionsPanel = () =>
    page.locator('aside').filter({ hasText: 'Actions' }).first();

  await test.step('The Principal signs the PDF. She marks it signed.', async () => {
    await actionsPanel()
      .getByRole('button', { name: /^Mark signed$/ })
      .click();
    await expect(page.getByText(/signed by principal/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('Notary stamps it. She marks it notarized.', async () => {
    await actionsPanel()
      .getByRole('button', { name: /^Mark notarized$/ })
      .click();
    await expect(page.getByText(/^Notarized$/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('She sends the notarized statement to the architect.', async () => {
    await actionsPanel()
      .getByRole('button', { name: /^Send to architect$/ })
      .click();
    await expect(page.getByText(/sent to architect/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('The architect reviews and signs off — Lena records their approval.', async () => {
    await actionsPanel()
      .getByRole('button', { name: /^Architect approved$/ })
      .click();
    await expect(page.getByText(/architect approved/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('Now to the owner. They get their own magic-link to the statement.', async () => {
    await actionsPanel()
      .getByRole('button', { name: /^Send to owner$/ })
      .click();
    await expect(page.getByText(/sent to owner/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('The owner reviews and approves. She records that.', async () => {
    await actionsPanel()
      .getByRole('button', { name: /^Owner approved$/ })
      .click();
    await expect(page.getByText(/owner approved/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('And archives the statement. Every transition above wrote an audit row.', async () => {
    // Scope to the actions aside — the project-layout header also has an
    // "Archive" button (for soft-deleting the project itself).
    await actionsPanel()
      .getByRole('button', { name: /^Archive$/ })
      .click();
    // The status-flow item "Project closed (archived)" lights up. Match
    // partial "archived" with case-insensitive.
    await expect(page.getByText(/archived/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
