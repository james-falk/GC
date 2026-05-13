import { test, expect } from '@playwright/test';

// Scenario 5 — Sworn statement chain. Illinois (and most states) require
// a notarized affidavit alongside the AIA pay-app. Lena walks the
// statement through its full state machine: generated → signed →
// notarized → sent to architect → architect approved → sent to owner →
// owner approved → archived.
//
// Demonstrates the same audit-trailed state-machine pattern used for
// COs and pay apps — every transition writes an approval_event.

test('Sworn statement state machine: full chain', async ({ page }) => {
  await test.step('From the April pay app, Lena opens the Sworn Statement view.', async () => {
    await page.goto('/projects');
    await page.getByRole('link', { name: 'Lincoln Elementary' }).click();
    await page.getByRole('link', { name: 'Pay Apps' }).click();
    await page.getByRole('link', { name: /Sworn statement/i }).click();
  });

  await test.step('She generates the sworn statement from the most recent owner pay-app.', async () => {
    await page.getByRole('button', { name: /Generate sworn statement/i }).click();
    await expect(page.getByText('Generated')).toBeVisible();
  });

  await test.step('The Principal signs the PDF. She marks it signed.', async () => {
    await page.getByRole('button', { name: 'Mark signed' }).click();
    await expect(page.getByText(/Signed by Principal/i)).toBeVisible();
  });

  await test.step('Notary stamps it. She marks it notarized.', async () => {
    await page.getByRole('button', { name: 'Mark notarized' }).click();
    await expect(page.getByText('Notarized')).toBeVisible();
  });

  await test.step('She sends the notarized statement to the architect.', async () => {
    await page.getByRole('button', { name: 'Send to architect' }).click();
    await expect(page.getByText('Sent to architect')).toBeVisible();
  });

  await test.step('The architect reviews and signs off — Lena records their approval.', async () => {
    await page.getByRole('button', { name: 'Architect approved' }).click();
    await expect(page.getByText('Architect approved')).toBeVisible();
  });

  await test.step('Now to the owner. They get their own magic-link to the statement.', async () => {
    await page.getByRole('button', { name: 'Send to owner' }).click();
    await expect(page.getByText('Sent to owner')).toBeVisible();
  });

  await test.step('The owner reviews and approves. She records that.', async () => {
    await page.getByRole('button', { name: 'Owner approved' }).click();
    await expect(page.getByText('Owner approved')).toBeVisible();
  });

  await test.step('And archives the statement. Every transition above wrote an audit row.', async () => {
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText(/archived/i)).toBeVisible();
  });
});
