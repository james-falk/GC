// Invariant #2 — SoV integrity.
// For each project: sum(SoVLine.current_amount where parent_line_id IS NULL)
// MUST equal project.original_contract_amount + sum(approved CO total_amount).
// Cents-precise comparison; if it drifts, surface on the dashboard.
// See docs/gc-data-model.md § Invariants.

import type { Cents } from './sub-billable-ceiling';

export type SovIntegrityInput = {
  projectOriginalAmountCents: Cents;
  approvedCoTotalCents: Cents;
  parentSovLineSumCents: Cents;
};

export type SovIntegrityResult =
  | { ok: true }
  | { ok: false; expectedCents: Cents; actualCents: Cents; gapCents: Cents };

export function checkSovIntegrity(input: SovIntegrityInput): SovIntegrityResult {
  if (
    !Number.isInteger(input.projectOriginalAmountCents) ||
    !Number.isInteger(input.approvedCoTotalCents) ||
    !Number.isInteger(input.parentSovLineSumCents)
  ) {
    throw new Error('checkSovIntegrity: inputs must be integer cents');
  }
  const expected = input.projectOriginalAmountCents + input.approvedCoTotalCents;
  const actual = input.parentSovLineSumCents;
  if (expected === actual) return { ok: true };
  return {
    ok: false,
    expectedCents: expected,
    actualCents: actual,
    gapCents: actual - expected,
  };
}
