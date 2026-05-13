import { test, expect } from '@playwright/test';

// Scenario 2 — Change Order travels the full chain. Lena drafts a CO,
// submits to Principal, who approves and ships a magic-link to the
// architect; architect approves, link to owner; owner approves;
// atomic propagation hits subcontract + SoV lines in lockstep.
//
// Depends on scenario 1 having created the Lincoln Elementary project
// with the Brothers & Bricks subcontract and the 3a / 3b SoV lines.

test('Change order chain: Brothers & Bricks adds $34,700', async ({ page, context }) => {
  await test.step('Lena drafts a change order for the south entrance brick wall extension.', async () => {
    await page.goto('/projects');
    await page.getByRole('link', { name: 'Lincoln Elementary' }).click();
    await page.getByRole('link', { name: 'Change Orders' }).click();
    await page.getByRole('link', { name: '+ Draft change order' }).click();

    await page.getByLabel('CO number').fill('CO-001');
    await page
      .getByLabel('Description')
      .fill('Add south entrance brick wall extension per RFI 014');
    await page
      .getByLabel('Justification')
      .fill('Approved scope addition; foundation already poured');
    await page
      .getByLabel('Affected subcontract')
      .selectOption({ label: /Brothers & Bricks/ });

    // Three line items: 3a brick, 3b block, 3 labor escalation.
    await page.getByLabel('Line item 1 — SoV line').selectOption({ label: /3a/ });
    await page.getByLabel('Line item 1 — delta').fill('8400.00');
    await page.getByLabel('Line item 1 — reason').fill('+200 SF brick');

    await page.getByRole('button', { name: 'Add another line' }).click();
    await page.getByLabel('Line item 2 — SoV line').selectOption({ label: /3b/ });
    await page.getByLabel('Line item 2 — delta').fill('24200.00');
    await page.getByLabel('Line item 2 — reason').fill('+700 SF block backup');

    await page.getByRole('button', { name: 'Add another line' }).click();
    await page.getByLabel('Line item 3 — SoV line').selectOption({ label: /^3 / });
    await page.getByLabel('Line item 3 — delta').fill('2100.00');
    await page.getByLabel('Line item 3 — reason').fill('+labor escalation');

    await page.getByRole('button', { name: /Save.*draft/i }).click();
    await expect(page.getByText('CO-001')).toBeVisible();
  });

  await test.step('She submits the CO to the Principal for in-app review.', async () => {
    await page.getByRole('button', { name: 'Submit to Principal' }).click();
    await expect(page.getByText('pending_principal')).toBeVisible();
  });

  await test.step('The Principal approves — a magic-link goes out to the architect.', async () => {
    await page.getByRole('button', { name: 'Principal approve' }).click();
    await expect(page.getByText(/architect/i)).toBeVisible();
  });

  await test.step('The architect opens the link in their inbox and reviews the change order.', async () => {
    // Pluck the architect URL from the banner. Format: <base>/approve/<64hex>.
    const banner = page.getByText(/\/approve\/[a-f0-9]{64}/);
    await expect(banner).toBeVisible();
    const architectUrl = (await banner.textContent())!.match(
      /https?:\/\/\S+\/approve\/[a-f0-9]{64}/,
    )![0];

    const architectTab = await context.newPage();
    await architectTab.goto(architectUrl);
    await expect(architectTab.getByText('CO-001')).toBeVisible();
    await architectTab.getByRole('button', { name: 'Approve' }).click();
    await expect(architectTab.getByText(/Thank you/i)).toBeVisible();
    await architectTab.close();
  });

  await test.step('The owner now gets their own link. They review the same line items.', async () => {
    await page.reload();
    const banner = page.getByText(/\/approve\/[a-f0-9]{64}/);
    await expect(banner).toBeVisible();
    const ownerUrl = (await banner.textContent())!.match(
      /https?:\/\/\S+\/approve\/[a-f0-9]{64}/,
    )![0];

    const ownerTab = await context.newPage();
    await ownerTab.goto(ownerUrl);
    await ownerTab.getByRole('button', { name: 'Approve' }).click();
    await expect(ownerTab.getByText(/Thank you/i)).toBeVisible();
    await ownerTab.close();
  });

  await test.step('At the moment the owner clicks approve, propagation fires. One transaction.', async () => {
    await page.reload();
    await expect(page.getByText('approved')).toBeVisible();
  });

  await test.step('The Brothers & Bricks subcontract jumps from $420,000 to $454,700.', async () => {
    await page.getByRole('link', { name: 'Subs' }).click();
    const row = page.getByRole('row', { name: /Brothers & Bricks/ });
    await expect(row).toContainText('$454,700.00');
  });

  await test.step('And the affected SoV lines update in lockstep — no drift, no manual reconcile.', async () => {
    await page.getByRole('link', { name: /SoV|Schedule of Values/i }).click();
    await expect(page.getByRole('row', { name: /3a/ })).toContainText('$288,400.00');
    await expect(page.getByRole('row', { name: /3b/ })).toContainText('$164,200.00');
  });
});
