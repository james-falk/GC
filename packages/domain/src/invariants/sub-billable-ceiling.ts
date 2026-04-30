// Invariant #1 — Sub billable ceiling.
// For any approved PayApplication where direction = 'sub_to_gc', the sum of
// (previously_billed + this_period) across all lines, by subcontract, MUST
// be ≤ that subcontract's current_amount. Submission attempts that violate
// this are blocked with the standard "exceeds your ceiling" error.
// See docs/gc-data-model.md § Invariants.
//
// Currency math is in integer cents (Cents = number) to avoid float drift.
// Conversion from numeric(14,2) -> cents happens at the DB-read boundary,
// not here — this function trusts its inputs are non-negative integer cents.

export type Cents = number;

export type SubBillableCeilingInput = {
  subcontractCurrentAmountCents: Cents;
  previouslyBilledAmountCents: Cents;
  thisPeriodAmountCents: Cents;
};

export type SubBillableCeilingResult =
  | { ok: true; remainingCents: Cents }
  | { ok: false; overageCents: Cents };

export function checkSubBillableCeiling(
  input: SubBillableCeilingInput,
): SubBillableCeilingResult {
  const ceiling = input.subcontractCurrentAmountCents;
  const previously = input.previouslyBilledAmountCents;
  const thisPeriod = input.thisPeriodAmountCents;

  if (
    !Number.isInteger(ceiling) ||
    !Number.isInteger(previously) ||
    !Number.isInteger(thisPeriod)
  ) {
    throw new Error('subBillableCeiling: inputs must be integer cents');
  }
  if (ceiling < 0 || previously < 0 || thisPeriod < 0) {
    throw new Error('subBillableCeiling: inputs must be non-negative');
  }

  const totalAfter = previously + thisPeriod;
  if (totalAfter <= ceiling) {
    return { ok: true, remainingCents: ceiling - totalAfter };
  }
  return { ok: false, overageCents: totalAfter - ceiling };
}
