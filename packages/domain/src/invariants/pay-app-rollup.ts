// Invariant #3 — Pay app rollup.
// For any period: sum(approved sub_to_gc pay-app billed) +
// GC-internal SoV billed for the same period SHOULD equal the
// gc_to_owner pay app billed for the same period, within a small
// reconciliation tolerance ($0.01 default, cents-precise).
// If it drifts, surface on the dashboard.

import type { Cents } from './sub-billable-ceiling';

export type PayAppRollupInput = {
  approvedSubBilledCents: Cents;
  gcInternalBilledCents: Cents;
  ownerPayAppBilledCents: Cents;
  toleranceCents?: Cents;
};

export type PayAppRollupResult =
  | { ok: true }
  | { ok: false; expectedCents: Cents; actualCents: Cents; gapCents: Cents };

export function checkPayAppRollup(input: PayAppRollupInput): PayAppRollupResult {
  if (
    !Number.isInteger(input.approvedSubBilledCents) ||
    !Number.isInteger(input.gcInternalBilledCents) ||
    !Number.isInteger(input.ownerPayAppBilledCents)
  ) {
    throw new Error('checkPayAppRollup: inputs must be integer cents');
  }
  const tolerance = input.toleranceCents ?? 1;
  if (!Number.isInteger(tolerance) || tolerance < 0) {
    throw new Error('checkPayAppRollup: toleranceCents must be a non-negative integer');
  }
  const expected = input.approvedSubBilledCents + input.gcInternalBilledCents;
  const actual = input.ownerPayAppBilledCents;
  if (Math.abs(expected - actual) <= tolerance) return { ok: true };
  return {
    ok: false,
    expectedCents: expected,
    actualCents: actual,
    gapCents: actual - expected,
  };
}
