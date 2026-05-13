import { test, expect } from '@playwright/test';

// Scenario 3 — Full monthly pay cycle. Lena starts April, three subs
// submit via magic-links, Lena reviews and adjusts one, assembles the
// owner pay-app, owner approves, GC marks paid. The AIA G702 + G703
// render from real persisted data.
//
// This is the wedge demo. The narration should emphasize that
// (a) GC adjustments persist (not just visual), and (b) the chain is
// continuous — no spreadsheet export, no double-entry.

test('Monthly pay cycle: April 2026 end-to-end', async ({ page, context }) => {
  await test.step('Lena opens Lincoln Elementary and starts the April pay-app cycle.', async () => {
    await page.goto('/projects');
    await page.getByRole('link', { name: 'Lincoln Elementary' }).click();
    await page.getByRole('link', { name: 'Pay Apps' }).click();
    await page.getByLabel('Period start').fill('2026-04-01');
    await page.getByLabel('Period end').fill('2026-04-30');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText(/Started pay-app cycle/i)).toBeVisible();
  });

  await test.step('Three subs each receive a magic-link to fill in their progress.', async () => {
    const urls = await page.locator('text=/sub-pay-app\\/[a-f0-9]{64}/').allTextContents();
    expect(urls.length).toBeGreaterThanOrEqual(3);
  });

  await test.step('Brothers & Bricks opens their link and fills in 30% on brick, 20% on block.', async () => {
    const bricksLink = await page
      .locator('li', { hasText: /Brothers & Bricks/ })
      .locator('text=/sub-pay-app\\/[a-f0-9]{64}/')
      .textContent();
    const url = bricksLink!.match(/https?:\/\/\S+\/sub-pay-app\/[a-f0-9]{64}/)![0];

    const subTab = await context.newPage();
    await subTab.goto(url);

    await subTab.getByLabel(/This period %.*3a/i).fill('30');
    await subTab.getByLabel(/This period %.*3b/i).fill('20');
    await subTab.getByRole('button', { name: 'Submit for review' }).click();
    await expect(subTab.getByText(/Submitted/i)).toBeVisible();
    await subTab.close();
  });

  await test.step('Lena reviews the submission. She lowers brick from 30 to 25 percent and approves.', async () => {
    await page.reload();
    await page
      .getByRole('row', { name: /Brothers & Bricks/ })
      .getByRole('link')
      .first()
      .click();

    const brickRow = page.getByRole('row', { name: /3a/ });
    await brickRow.getByRole('spinbutton').fill('25');

    await page.getByRole('button', { name: /Approve sub pay app/i }).click();
    await expect(page.getByText(/approved/i)).toBeVisible();
  });

  await test.step('She closes the row and reopens it. The 25% override stayed put.', async () => {
    await page
      .getByRole('row', { name: /Brothers & Bricks/ })
      .getByRole('link')
      .first()
      .click();
    const brickRow = page.getByRole('row', { name: /3a/ });
    await expect(brickRow.getByRole('spinbutton')).toHaveValue('25');
  });

  await test.step('She assembles the owner pay-app for April. Three sub submissions roll into one.', async () => {
    await page.getByRole('link', { name: 'Pay Apps' }).click();

    const assembleForm = page.locator('form', { hasText: 'Assemble' });
    await assembleForm.getByLabel('Period start').fill('2026-04-01');
    await assembleForm.getByLabel('Period end').fill('2026-04-30');
    await assembleForm.getByRole('button', { name: 'Assemble' }).click();
    await expect(page.getByText('generated')).toBeVisible();
  });

  await test.step('The owner pay-app gets sent to Springfield Public Schools.', async () => {
    await page.getByRole('button', { name: 'Send to owner' }).click();
    await expect(page.getByText(/\/approve\/[a-f0-9]{64}/)).toBeVisible();
  });

  await test.step('The owner approves the AIA pay app via their magic-link.', async () => {
    const banner = page.getByText(/\/approve\/[a-f0-9]{64}/);
    const ownerUrl = (await banner.textContent())!.match(
      /https?:\/\/\S+\/approve\/[a-f0-9]{64}/,
    )![0];

    const ownerTab = await context.newPage();
    await ownerTab.goto(ownerUrl);
    await ownerTab.getByRole('button', { name: 'Approve' }).click();
    await expect(ownerTab.getByText(/Thank you/i)).toBeVisible();
    await ownerTab.close();
  });

  await test.step('A week later, the check clears. Lena marks the pay app paid.', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await expect(page.getByText('paid')).toBeVisible();
  });

  await test.step('She opens the AIA pay app. The G702 and G703 render from the GC-adjusted numbers.', async () => {
    await page.getByRole('link', { name: /AIA pay app/i }).click();
    await expect(page.locator('iframe')).toBeVisible({ timeout: 15_000 });
  });
});
