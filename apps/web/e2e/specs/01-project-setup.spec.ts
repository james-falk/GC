import { test, expect } from '../fixtures/cursor';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Scenario 1 — Lena, the project manager at Spartan, sets up Lincoln
// Elementary Renovation Phase 2: organizations, project, subs,
// subcontracts, and a SoV imported from CSV.
//
// Implementation note: we use page.goto() for cross-page navigation
// rather than sidebar clicks. Soft-nav races against Next.js's RSC
// streaming were causing flakiness — the URL would change but the new
// page's content lagged behind the assertion. Direct goto() is more
// reliable and the screen recording still shows page transitions
// clearly because of slowMo + the URL bar change.
//
// Step titles double as ElevenLabs narration — write as you'd speak.
//
// Data lifecycle: specs run in declared order (Playwright serial,
// workers: 1). Re-running creates duplicate orgs / projects; the spec
// matches by partial text so the freshest copy always wins.

const SAMPLE_CSV = resolve(__dirname, '../fixtures/lincoln-sov.csv');

test('Project setup: Lincoln Elementary Phase 2', async ({ page }) => {
  await test.step('Lena, the project manager at Spartan, signs into her workspace.', async () => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  await test.step('She adds Springfield Public Schools as the project owner.', async () => {
    await page.goto('/organizations/new');
    await expect(page.getByRole('heading', { name: /add organization/i })).toBeVisible();
    await page.getByLabel('Name').fill('Springfield Public Schools');
    await page.getByLabel('Type').selectOption('owner');
    await page.getByLabel(/contact email/i).fill('owner@example.com');
    await page.getByRole('button', { name: /add organization/i }).click();
    await expect(page.getByText('Springfield Public Schools').first()).toBeVisible();
  });

  await test.step('And Northbridge Architecture as the architect.', async () => {
    await page.goto('/organizations/new');
    await page.getByLabel('Name').fill('Northbridge Architecture');
    await page.getByLabel('Type').selectOption('architect');
    await page.getByLabel(/contact email/i).fill('architect@example.com');
    await page.getByRole('button', { name: /add organization/i }).click();
    await expect(page.getByText('Northbridge Architecture').first()).toBeVisible();
  });

  await test.step('She creates a new project — Lincoln Elementary Renovation Phase 2 — at 2.4 million dollars.', async () => {
    await page.goto('/projects/new');
    await expect(page.getByRole('heading', { name: /new project/i })).toBeVisible();
    await page.getByLabel(/project number/i).fill('LE-2');
    await page.getByLabel('Name', { exact: true }).fill('Lincoln Elementary Renovation Phase 2');
    await page.getByLabel(/original contract amount/i).fill('2400000.00');
    await page.getByLabel(/owner/i).selectOption({ label: 'Springfield Public Schools' });
    await page.getByLabel(/architect/i).selectOption({ label: 'Northbridge Architecture' });
    await page.getByRole('button', { name: /create project/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Lincoln Elementary Renovation Phase 2' }),
    ).toBeVisible({ timeout: 30_000 });
  });

  await test.step('She adds three subcontractors to her directory.', async () => {
    for (const sub of [
      { name: 'Brothers & Bricks Masonry', email: 'bricks@example.com' },
      { name: 'Apex Electric', email: 'apex@example.com' },
      { name: 'Solid Mechanical', email: 'solid@example.com' },
    ]) {
      await page.goto('/subcontractors/new');
      await page.getByLabel('Name').fill(sub.name);
      await page.getByLabel(/contact email/i).fill(sub.email);
      await page.getByRole('button', { name: /add subcontractor/i }).click();
      await expect(page.getByText(sub.name).first()).toBeVisible();
    }
  });

  await test.step('She attaches each sub to Lincoln Elementary with a contract.', async () => {
    // Re-locate the project URL — projects/[id] sort by createdAt desc,
    // so the freshest Lincoln Elementary is the first row.
    await page.goto('/projects');
    const projectLink = page.getByRole('link', { name: /Lincoln Elementary Renovation Phase 2/ }).first();
    await projectLink.click();
    await expect(
      page.getByRole('heading', { name: 'Lincoln Elementary Renovation Phase 2' }),
    ).toBeVisible();

    const projectUrl = page.url();

    for (const sub of [
      { name: 'Brothers & Bricks Masonry', contractNumber: 'LE-2-002', amount: '420000.00' },
      { name: 'Apex Electric', contractNumber: 'LE-2-003', amount: '185000.00' },
      { name: 'Solid Mechanical', contractNumber: 'LE-2-004', amount: '310000.00' },
    ]) {
      await page.goto(`${projectUrl}/subs/new`);
      await expect(
        page.getByRole('heading', { name: /add subcontract/i }),
      ).toBeVisible({ timeout: 30_000 });
      await page.getByLabel('Subcontractor').selectOption({ label: sub.name });
      await page.getByLabel('Contract number').fill(sub.contractNumber);
      await page.getByLabel('Original amount').fill(sub.amount);
      await page.getByLabel('Status').selectOption('active');
      await page.getByRole('button', { name: 'Add subcontract' }).click();
      // After redirect to /projects/<id>/subs, the new row shows the
      // contract number. Generous timeout — Next compiles the route.
      await expect(page.getByText(sub.contractNumber).first()).toBeVisible({
        timeout: 30_000,
      });
    }
  });

  await test.step('She imports the schedule of values — seven lines, with a parent for masonry and two children.', async () => {
    // Navigate to the SoV tab on this project. URL pattern:
    // /projects/<uuid>  is the SoV tab (default).
    await page.goto('/projects');
    await page.getByRole('link', { name: /Lincoln Elementary Renovation Phase 2/ }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Schedule of Values' }),
    ).toBeVisible();

    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /choose csv/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(SAMPLE_CSV);

    // After upload the page revalidates. Wait for the count summary
    // ("5 top-level lines, 2 child lines") which is unique on the page,
    // then verify the specific cells appeared.
    await expect(
      page.getByText(/top-level line/i).first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('cell', { name: '3a' })).toBeVisible();
    await expect(page.getByRole('cell', { name: '3b' })).toBeVisible();
  });

  await test.step('Project stood up. Three subcontractors, seven SoV lines, two-point-four million in scope, zero drift.', async () => {
    // Final beat: KPI strip shows the totals. Just verify the contract
    // value tile is rendered with the expected number.
    await expect(page.getByText(/contract value/i)).toBeVisible();
    await expect(page.getByText('$2,400,000.00').first()).toBeVisible();
  });
});
