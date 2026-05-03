// Invariant #5 — Retention balance.
// Total retention withheld across all approved sub_to_gc pay apps for a
// project should match the sum of retention amounts on the corresponding
// gc_to_owner pay app(s) for those same periods. If they drift, retention
// has been double-counted, dropped, or released early.
//
// Cents-precise comparison; small reconciliation tolerance allowed.

import type { Cents } from './sub-billable-ceiling';

export type RetentionBalanceInput = {
  subRetentionCents: Cents; // sum across approved sub pay apps
  ownerRetentionCents: Cents; // sum across owner pay apps for the same periods
  toleranceCents?: Cents;
};

export type RetentionBalanceResult =
  | { ok: true }
  | { ok: false; expectedCents: Cents; actualCents: Cents; gapCents: Cents };

export function checkRetentionBalance(
  input: RetentionBalanceInput,
): RetentionBalanceResult {
  if (
    !Number.isInteger(input.subRetentionCents) ||
    !Number.isInteger(input.ownerRetentionCents)
  ) {
    throw new Error('checkRetentionBalance: inputs must be integer cents');
  }
  const tolerance = input.toleranceCents ?? 1;
  if (!Number.isInteger(tolerance) || tolerance < 0) {
    throw new Error(
      'checkRetentionBalance: toleranceCents must be a non-negative integer',
    );
  }
  if (Math.abs(input.subRetentionCents - input.ownerRetentionCents) <= tolerance) {
    return { ok: true };
  }
  return {
    ok: false,
    expectedCents: input.subRetentionCents,
    actualCents: input.ownerRetentionCents,
    gapCents: input.ownerRetentionCents - input.subRetentionCents,
  };
}
