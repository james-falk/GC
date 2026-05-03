// Invariant #4 — CO not propagated.
// When a ChangeOrder transitions to 'approved', the system in a single
// transaction updates the affected subcontract's current_amount and each
// affected SoVLine's current_amount. If the CO is approved but the
// expected propagation hasn't happened (or partially happened), surface
// on the dashboard.
//
// Practical detection at query-time: a CO is in 'approved' state but
// either subcontract.current_amount or sov_line.current_amount values
// don't reflect the CO's deltas. We compare expected vs actual values
// per affected entity and report any discrepancies.

import type { Cents } from './sub-billable-ceiling';

export type CoPropagationCheckInput = {
  // Expected: subcontract.original_amount + sum(approved CO deltas
  // targeting this subcontract).
  subcontractExpectedCurrentCents: Cents;
  subcontractActualCurrentCents: Cents;
};

export type CoPropagationCheckResult =
  | { ok: true }
  | {
      ok: false;
      expectedCents: Cents;
      actualCents: Cents;
      gapCents: Cents;
    };

export function checkCoPropagation(
  input: CoPropagationCheckInput,
): CoPropagationCheckResult {
  if (
    !Number.isInteger(input.subcontractExpectedCurrentCents) ||
    !Number.isInteger(input.subcontractActualCurrentCents)
  ) {
    throw new Error('checkCoPropagation: inputs must be integer cents');
  }
  if (input.subcontractExpectedCurrentCents === input.subcontractActualCurrentCents) {
    return { ok: true };
  }
  return {
    ok: false,
    expectedCents: input.subcontractExpectedCurrentCents,
    actualCents: input.subcontractActualCurrentCents,
    gapCents:
      input.subcontractActualCurrentCents - input.subcontractExpectedCurrentCents,
  };
}
