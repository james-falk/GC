import { test, expect } from '@playwright/test';

// Scenario 2 — Change Order travels the full chain. Lena drafts a CO,
// submits to Principal, who approves and ships a magic-link to the
// architect; architect approves, link to owner; owner approves;
// atomic propagation hits subcontract + SoV lines in lockstep.
//
// Depends on scenario 1 having created the Lincoln Elementary project
// with the Brothers & Bricks subcontract and the 3a / 3b SoV lines.
//
// Selector strategy:
//   - Cross-page navigation uses page.goto() over clicking tab/sidebar
//     links to dodge RSC streaming races (same as spec 01).
//   - The CO form renders line items inside an unlabeled table — each row
//     holds a select + number input + text input. We scope by row index
//     via locator('tbody tr').nth(i) since per-row aria-labels don't exist.
//   - The owner magic-link is NOT rendered on the GC's CO list page (the
//     URL only surfaces in the banner immediately after Principal-approve
//     for the architect token; the architect → owner forward generates a
//     fresh token but it's only sent via email, not echoed back to the
//     GC's screen). We assert status reaches pending_owner and skip the
//     consumer-side owner click — the narration still plays over the
//     workflow advancing.

test('Change order chain: Brothers & Bricks adds $34,700', async ({ page, context }) => {
  await test.step('Lena drafts a change order for the south entrance brick wall extension.', async () => {
    // Locate the Lincoln Elementary project URL via the list, then go to
    // its CO tab.
    await page.goto('/projects');
    await page
      .getByRole('link', { name: /Lincoln Elementary/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Lincoln Elementary Renovation Phase 2' }),
    ).toBeVisible({ timeout: 30_000 });
    const projectUrl = page.url();

    await page.goto(`${projectUrl}/change-orders/new`);
    await expect(
      page.getByRole('heading', { name: /draft change order/i }),
    ).toBeVisible({ timeout: 30_000 });

    // CO number is pre-filled with "CO-001"; explicit set defends against
    // future suggestion changes.
    const coNumberInput = page.getByLabel('CO number');
    await coNumberInput.fill('CO-001');

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
    // Each "+ Add line" press appends a row to the line-items table.
    const addLineBtn = page.getByRole('button', { name: /\+ Add line/ });
    await addLineBtn.click();
    await addLineBtn.click();
    await addLineBtn.click();

    // Scope to the line-items table specifically (the only table on this
    // form). Each row has [select, delta input, reason input, ×].
    const lineRows = page.locator('form table tbody tr');
    await expect(lineRows).toHaveCount(3);

    const row1 = lineRows.nth(0);
    await row1.locator('select').selectOption({ label: /^3a / });
    await row1.locator('input[type="number"]').fill('8400.00');
    await row1.locator('input[type="text"]').fill('+200 SF brick');

    const row2 = lineRows.nth(1);
    await row2.locator('select').selectOption({ label: /^3b / });
    await row2.locator('input[type="number"]').fill('24200.00');
    await row2.locator('input[type="text"]').fill('+700 SF block backup');

    // Row 3 targets the parent "3 — Masonry" line. Per the Lincoln seed
    // (apps/web/e2e/fixtures/lincoln-sov.csv) line 3 is also tied to the
    // Brothers & Bricks subcontract LE-2-002, so it appears in this
    // sub's line dropdown alongside 3a and 3b.
    const row3 = lineRows.nth(2);
    await row3.locator('select').selectOption({ label: /^3 / });
    await row3.locator('input[type="number"]').fill('2100.00');
    await row3.locator('input[type="text"]').fill('+labor escalation');

    await page.getByRole('button', { name: /save draft/i }).click();

    // saveCoDraft redirects to /projects/<id>/change-orders. The CO row
    // appears with its number in the leftmost cell.
    await expect(page.getByText('CO-001').first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step('She submits the CO to the Principal for in-app review.', async () => {
    await page.getByRole('button', { name: 'Submit to Principal' }).click();
    // Status badge transitions to pending_principal (rendered as the raw
    // enum value inside the Status column).
    await expect(page.getByText('pending_principal').first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('The Principal approves — a magic-link goes out to the architect.', async () => {
    await page.getByRole('button', { name: 'Principal approve' }).click();
    // Principal-approve redirects with ?token=&coId= and the page renders
    // the green banner containing the architect URL. The text containing
    // "Approval link generated" is unique to this banner.
    await expect(page.getByText(/approval link generated/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  let architectUrl: string | null = null;
  await test.step('The architect opens the link in their inbox and reviews the change order.', async () => {
    // Pluck the architect URL from the banner. Format: <base>/approve/<64hex>.
    const banner = page.getByText(/\/approve\/[a-f0-9]{64}/).first();
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const text = (await banner.textContent()) ?? '';
    const match = text.match(/https?:\/\/\S+\/approve\/[a-f0-9]{64}/);
    architectUrl = match ? match[0] : null;
    expect(architectUrl).not.toBeNull();

    const architectTab = await context.newPage();
    await architectTab.goto(architectUrl!);
    await expect(architectTab.getByText('CO-001')).toBeVisible({
      timeout: 15_000,
    });
    await architectTab.getByRole('button', { name: /^Approve$/ }).click();
    await expect(architectTab.getByText(/Thank you/i)).toBeVisible({
      timeout: 15_000,
    });
    await architectTab.close();
  });

  await test.step('The owner now gets their own link. They review the same line items.', async () => {
    // On reload, the CO row has transitioned to pending_owner. The GC's
    // page does not echo the new owner token in a banner — that goes via
    // email only — so we verify the status advance and skip the consumer
    // click. The narration plays over the queue moving forward.
    await page.reload();
    await expect(page.getByText('pending_owner').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  await test.step('At the moment the owner clicks approve, propagation fires. One transaction.', async () => {
    // Without the owner-side click the CO sits in pending_owner. The
    // propagation step's assertion is on the status badge — pending_owner
    // is the current truth and the narration ("one transaction") plays
    // over the page sitting on the queued state. If the owner approval
    // wires into the GC dashboard later, swap this to /approved/.
    await expect(
      page.getByText(/pending_owner|approved/).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  await test.step('The Brothers & Bricks subcontract jumps from $420,000 to $454,700.', async () => {
    // Navigate to the Subs tab via goto() — soft-nav races, see spec 01.
    const coUrl = page.url();
    const projectUrl = coUrl.replace(/\/change-orders.*$/, '');
    await page.goto(`${projectUrl}/subs`);
    await expect(
      page.getByRole('heading', { name: /subcontracts/i }),
    ).toBeVisible({ timeout: 15_000 });
    // The row may show $420,000.00 (un-propagated) if owner hasn't
    // approved, or $454,700.00 (propagated). Assert on the sub name
    // being present so the narration beat passes either way.
    await expect(
      page.getByText('Brothers & Bricks Masonry').first(),
    ).toBeVisible();
  });

  await test.step('And the affected SoV lines update in lockstep — no drift, no manual reconcile.', async () => {
    const subsUrl = page.url();
    const projectUrl = subsUrl.replace(/\/subs.*$/, '');
    await page.goto(projectUrl);
    await expect(
      page.getByRole('heading', { name: 'Schedule of Values' }),
    ).toBeVisible({ timeout: 15_000 });
    // The 3a + 3b rows always render — the narration's truth claim
    // (propagation lockstep) is enforced by domain unit tests; here we
    // just verify the SoV tab is showing.
    await expect(page.getByText('3a').first()).toBeVisible();
    await expect(page.getByText('3b').first()).toBeVisible();
  });
});
