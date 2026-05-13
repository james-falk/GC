import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

// Scenario 1 — Lena, the project manager at Spartan, sets up Lincoln
// Elementary Renovation Phase 2: organizations, project, subs,
// subcontracts, and a SoV imported from CSV.
//
// Step titles double as ElevenLabs narration — write them as you'd
// want them spoken, not as terse test descriptions.

const SAMPLE_CSV = resolve(__dirname, '../fixtures/lincoln-sov.csv');

test('Project setup: Lincoln Elementary Phase 2', async ({ page }) => {
  await test.step('Lena, the project manager at Spartan, signs into her workspace.', async () => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  await test.step('She adds Springfield Public Schools as the project owner.', async () => {
    await page.getByRole('link', { name: 'Organizations' }).click();
    await page.getByRole('link', { name: '+ Add organization' }).click();
    await page.getByLabel('Name').fill('Springfield Public Schools');
    await page.getByLabel('Type').selectOption('owner');
    await page.getByLabel('Contact email').fill('owner@example.com');
    await page.getByRole('button', { name: 'Add organization' }).click();
    await expect(page.getByText('Springfield Public Schools')).toBeVisible();
  });

  await test.step('And Northbridge Architecture as the architect.', async () => {
    await page.getByRole('link', { name: '+ Add organization' }).click();
    await page.getByLabel('Name').fill('Northbridge Architecture');
    await page.getByLabel('Type').selectOption('architect');
    await page.getByLabel('Contact email').fill('architect@example.com');
    await page.getByRole('button', { name: 'Add organization' }).click();
    await expect(page.getByText('Northbridge Architecture')).toBeVisible();
  });

  await test.step('She creates a new project — Lincoln Elementary Renovation Phase 2 — at 2.4 million dollars.', async () => {
    await page.getByRole('link', { name: 'Projects' }).click();
    await page.getByRole('link', { name: '+ New project' }).click();
    await page.getByLabel('Project number').fill('LE-2');
    await page.getByLabel('Name').fill('Lincoln Elementary Renovation Phase 2');
    await page.getByLabel('Original contract amount').fill('2400000.00');
    await page.getByLabel('Owner').selectOption({ label: 'Springfield Public Schools' });
    await page.getByLabel('Architect').selectOption({ label: 'Northbridge Architecture' });
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByText('Lincoln Elementary Renovation Phase 2')).toBeVisible();
  });

  await test.step('She adds three subcontractors to her directory.', async () => {
    for (const sub of [
      { name: 'Brothers & Bricks Masonry', email: 'bricks@example.com' },
      { name: 'Apex Electric', email: 'apex@example.com' },
      { name: 'Solid Mechanical', email: 'solid@example.com' },
    ]) {
      await page.getByRole('link', { name: 'Subcontractors' }).click();
      await page.getByRole('link', { name: '+ Add subcontractor' }).click();
      await page.getByLabel('Name').fill(sub.name);
      await page.getByLabel('Contact email').fill(sub.email);
      await page.getByRole('button', { name: 'Add subcontractor' }).click();
      await expect(page.getByText(sub.name)).toBeVisible();
    }
  });

  await test.step('She attaches each sub to Lincoln Elementary with a contract.', async () => {
    await page.getByRole('link', { name: 'Projects' }).click();
    await page.getByRole('link', { name: 'Lincoln Elementary' }).click();
    await page.getByRole('link', { name: 'Subs' }).click();

    for (const sub of [
      { name: 'Brothers & Bricks Masonry', contractNumber: 'LE-2-002', amount: '420000.00' },
      { name: 'Apex Electric', contractNumber: 'LE-2-003', amount: '185000.00' },
      { name: 'Solid Mechanical', contractNumber: 'LE-2-004', amount: '310000.00' },
    ]) {
      await page.getByRole('link', { name: '+ Add subcontract' }).click();
      await page.getByLabel('Subcontractor').selectOption({ label: sub.name });
      await page.getByLabel('Contract number').fill(sub.contractNumber);
      await page.getByLabel('Original amount').fill(sub.amount);
      await page.getByLabel('Status').selectOption('active');
      await page.getByRole('button', { name: 'Create subcontract' }).click();
      await expect(page.getByText(sub.contractNumber)).toBeVisible();
    }
  });

  await test.step('She uploads the schedule of values — seven lines, with a parent for masonry and two children.', async () => {
    await page.getByRole('link', { name: 'SoV' }).click().catch(async () => {
      // SoV may be the default tab; if no link, the table is already visible.
    });
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Choose CSV/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV);

    // After upload the page revalidates; wait for the imported lines.
    await expect(page.getByText('3a')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('3b')).toBeVisible();
  });

  await test.step('The hierarchy renders correctly — children indented under their parent.', async () => {
    // Visual check via screenshot; assertion is the indentation column on
    // the row for line 3a versus line 3.
    await expect(page).toHaveScreenshot('sov-hierarchy.png', { maxDiffPixels: 200 });
  });
});
