import { test, expect } from '@playwright/test';

// Scenario 3 — Full monthly pay cycle. Lena starts April, three subs
// submit via magic-links, Lena reviews and adjusts one, assembles the
// owner pay-app, owner approves, GC marks paid. The AIA G702 + G703
// render from real persisted data.
//
// This is the wedge demo. The narration should emphasize that
// (a) GC adjustments persist (not just visual), and (b) the chain is
// continuous — no spreadsheet export, no double-entry.
//
// Selector notes:
//   - The Pay Apps page renders TWO forms with the same labels
//     ("Period start" / "Period end") — one for "Start monthly pay-app
//     cycle", one for "Assemble owner pay app". We always scope by form
//     parent locator hasText: 'Start' or 'Assemble' to disambiguate.
//   - The sub portal form has multiple "This period %" inputs (one per
//     SoV line). Each card wraps a single line; we scope via the card's
//     containing text (e.g. "3a — Stone & block delivery").
//   - The owner magic-link banner only appears immediately after the
//     "Send to owner" click via redirect-pushed searchParams. We pluck
//     the token then close the banner.

test('Monthly pay cycle: April 2026 end-to-end', async ({ page, context }) => {
  await test.step('Lena opens Lincoln Elementary and starts the April pay-app cycle.', async () => {
    await page.goto('/projects');
    await page
      .getByRole('link', { name: /Lincoln Elementary/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: 'Lincoln Elementary Renovation Phase 2' }),
    ).toBeVisible({ timeout: 30_000 });
    const projectUrl = page.url();
    await page.goto(`${projectUrl}/pay-apps`);
    await expect(
      page.getByRole('heading', { name: /pay apps/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Scope to the Start form — same labels ("Period start" / "Period
    // end") appear in the sibling Assemble form. The heading
    // "Start monthly pay-app cycle" lives in an <h3> outside the <form>
    // tag, so we anchor on the wrapping <div> that contains the heading
    // but NOT the Assemble heading (the outer grid div contains both
    // headings; this filter chain excludes it).
    const startScope = page
      .locator('div')
      .filter({ hasText: 'Start monthly pay-app cycle' })
      .filter({ hasNot: page.getByText('Assemble owner pay app') })
      .first()
      .locator('form');

    await startScope.getByLabel('Period start').fill('2026-04-01');
    await startScope.getByLabel('Period end').fill('2026-04-30');
    await startScope.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText(/started pay-app cycle/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('Three subs each receive a magic-link to fill in their progress.', async () => {
    // The banner lists each generated link. Assert at least one URL
    // matching /sub-pay-app/<64hex> is visible. Real count depends on
    // how many subs from scenario 1 have a contact_email; the seed gives
    // all three an email so 3 is the realistic target.
    const links = page.locator('text=/sub-pay-app\\/[a-f0-9]{64}/');
    await expect(links.first()).toBeVisible({ timeout: 15_000 });
  });

  await test.step('Brothers & Bricks opens their link and fills in 30% on brick, 20% on block.', async () => {
    // Each generated URL is rendered inside an <li> with the sub name
    // above it. Pick the Brothers & Bricks <li>.
    const bricksLi = page
      .locator('li')
      .filter({ hasText: /Brothers & Bricks/ })
      .first();
    await expect(bricksLi).toBeVisible({ timeout: 15_000 });
    const bricksLinkText = (await bricksLi.textContent()) ?? '';
    const match = bricksLinkText.match(
      /https?:\/\/\S+\/sub-pay-app\/[a-f0-9]{64}/,
    );
    expect(match).not.toBeNull();
    const url = match![0];

    const subTab = await context.newPage();
    await subTab.goto(url);

    // The portal form has one card per SoV line. Each card holds a
    // description div ("3a — Brick", "3b — Block") and a "This period %"
    // input below. To target a single card we (a) filter divs whose
    // text starts with the line-number prefix, (b) require a
    // "This period %" label to be inside (rules out the outer
    // space-y-4 container which contains all cards), and (c) exclude
    // divs that ALSO contain the OTHER line's description (rules out
    // the outer container which has both 3a and 3b text).
    const card3a = subTab
      .locator('div')
      .filter({ hasText: /3a — / })
      .filter({
        has: subTab.locator('label', { hasText: 'This period %' }),
      })
      .filter({ hasNot: subTab.getByText(/3b — /) })
      .first();
    await card3a
      .getByLabel('This period %', { exact: true })
      .fill('30');

    const card3b = subTab
      .locator('div')
      .filter({ hasText: /3b — / })
      .filter({
        has: subTab.locator('label', { hasText: 'This period %' }),
      })
      .filter({ hasNot: subTab.getByText(/3a — /) })
      .first();
    await card3b
      .getByLabel('This period %', { exact: true })
      .fill('20');

    await subTab.getByRole('button', { name: 'Submit for review' }).click();
    await expect(subTab.getByText(/submitted\.?/i)).toBeVisible({
      timeout: 15_000,
    });
    await subTab.close();
  });

  await test.step('Lena reviews the submission. She lowers brick from 30 to 25 percent and approves.', async () => {
    await page.reload();
    // The Pay Apps table shows submitted subs by name; clicking the sub's
    // name opens the review page. Restrict to sub_to_gc rows.
    await page
      .getByRole('link', { name: /Brothers & Bricks/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: /Review pay app/i }),
    ).toBeVisible({ timeout: 30_000 });

    // Locate the 3a row in the review table. The cell containing the
    // line number + description is in the first column. The GC adjusted
    // % input is a number input inside the row.
    const brickRow = page
      .locator('tbody tr')
      .filter({ hasText: /3a/ })
      .first();
    const adjustedInput = brickRow.locator('input[type="number"]');
    await adjustedInput.fill('25');

    await page.getByRole('button', { name: /Approve sub pay app/i }).click();
    // After approve, the action redirects back to the project pay-apps
    // list. We assert the page shows the project pay-apps heading + that
    // the previously-submitted row is now approved.
    await expect(
      page.getByRole('heading', { name: /pay apps/i }).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/approved_by_pm|approved/).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('She closes the row and reopens it. The 25% override stayed put.', async () => {
    // Re-open the Brothers & Bricks pay-app from the list.
    await page
      .getByRole('link', { name: /Brothers & Bricks/ })
      .first()
      .click();
    await expect(
      page.getByRole('heading', { name: /Review pay app/i }),
    ).toBeVisible({ timeout: 15_000 });

    const brickRow = page
      .locator('tbody tr')
      .filter({ hasText: /3a/ })
      .first();
    // Approved rows render the input disabled but keep the value. The
    // adjusted column may show "25.00" — match by partial.
    const adjustedInput = brickRow.locator('input[type="number"]');
    await expect(adjustedInput).toHaveValue(/^25(\.0+)?$/);
  });

  await test.step('She assembles the owner pay-app for April. Three sub submissions roll into one.', async () => {
    // Back to the Pay Apps tab via goto() — link-click would race the RSC stream.
    const reviewUrl = page.url();
    const projectUrl = reviewUrl.replace(/\/pay-apps\/.*$/, '');
    await page.goto(`${projectUrl}/pay-apps`);
    await expect(
      page.getByRole('heading', { name: /pay apps/i }).first(),
    ).toBeVisible({ timeout: 30_000 });

    // Scope to the Assemble form via its wrapping <div> heading
    // ("Assemble owner pay app"). Same dance as the Start form earlier
    // — exclude divs that also contain the Start heading so we don't
    // resolve to the outer grid wrapper.
    const assembleScope = page
      .locator('div')
      .filter({ hasText: 'Assemble owner pay app' })
      .filter({ hasNot: page.getByText('Start monthly pay-app cycle') })
      .first()
      .locator('form');
    await assembleScope.getByLabel('Period start').fill('2026-04-01');
    await assembleScope.getByLabel('Period end').fill('2026-04-30');
    await assembleScope.getByRole('button', { name: 'Assemble' }).click();
    // After assemble, a gc_to_owner pay app row appears with status
    // 'generated'.
    await expect(page.getByText('generated').first()).toBeVisible({
      timeout: 30_000,
    });
  });

  await test.step('The owner pay-app gets sent to Springfield Public Schools.', async () => {
    await page.getByRole('button', { name: 'Send to owner' }).click();
    // The post-submit redirect sets ?ownerLinkToken=...&ownerLinkPayApp=...
    // and the page renders an emerald banner with the URL.
    await expect(page.getByText(/owner approval link generated/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('The owner approves the AIA pay app via their magic-link.', async () => {
    const banner = page.getByText(/\/approve\/[a-f0-9]{64}/).first();
    await expect(banner).toBeVisible({ timeout: 15_000 });
    const text = (await banner.textContent()) ?? '';
    const match = text.match(/https?:\/\/\S+\/approve\/[a-f0-9]{64}/);
    expect(match).not.toBeNull();
    const ownerUrl = match![0];

    const ownerTab = await context.newPage();
    await ownerTab.goto(ownerUrl);
    await ownerTab.getByRole('button', { name: /^Approve$/ }).click();
    await expect(ownerTab.getByText(/Thank you/i)).toBeVisible({
      timeout: 15_000,
    });
    await ownerTab.close();
  });

  await test.step('A week later, the check clears. Lena marks the pay app paid.', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await expect(page.getByText(/^paid$/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step('She opens the AIA pay app. The G702 and G703 render from the GC-adjusted numbers.', async () => {
    // AIA link in the pay-apps page header (renders with trailing arrow).
    await page.getByRole('link', { name: /AIA pay app/i }).click();
    await expect(
      page.getByRole('heading', { name: /AIA Pay App/i }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('iframe')).toBeVisible({ timeout: 30_000 });
  });
});
