import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkSubBillableCeiling } from './sub-billable-ceiling';

describe('checkSubBillableCeiling', () => {
  it('hand example — exactly at ceiling is ok with zero remaining', () => {
    const result = checkSubBillableCeiling({
      subcontractCurrentAmountCents: 100_00,
      previouslyBilledAmountCents: 60_00,
      thisPeriodAmountCents: 40_00,
    });
    expect(result).toEqual({ ok: true, remainingCents: 0 });
  });

  it('hand example — one cent over ceiling is rejected with overage 1', () => {
    const result = checkSubBillableCeiling({
      subcontractCurrentAmountCents: 100_00,
      previouslyBilledAmountCents: 60_00,
      thisPeriodAmountCents: 40_01,
    });
    expect(result).toEqual({ ok: false, overageCents: 1 });
  });

  it('hand example — strictly under ceiling reports remaining', () => {
    const result = checkSubBillableCeiling({
      subcontractCurrentAmountCents: 100_00,
      previouslyBilledAmountCents: 30_00,
      thisPeriodAmountCents: 25_00,
    });
    expect(result).toEqual({ ok: true, remainingCents: 45_00 });
  });

  it('rejects non-integer inputs', () => {
    expect(() =>
      checkSubBillableCeiling({
        subcontractCurrentAmountCents: 100.5,
        previouslyBilledAmountCents: 0,
        thisPeriodAmountCents: 0,
      }),
    ).toThrow(/integer cents/);
  });

  it('rejects negative inputs', () => {
    expect(() =>
      checkSubBillableCeiling({
        subcontractCurrentAmountCents: 100,
        previouslyBilledAmountCents: -1,
        thisPeriodAmountCents: 0,
      }),
    ).toThrow(/non-negative/);
  });

  // Property-based: for any non-negative integer (ceiling, previously, thisPeriod),
  // the result is consistent with the arithmetic definition of the invariant.
  it('property: ok iff previously + thisPeriod ≤ ceiling, with exact remaining/overage', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000_000_000 }), // up to $10B in cents
        fc.nat({ max: 1_000_000_000_000 }),
        fc.nat({ max: 1_000_000_000_000 }),
        (ceiling, previously, thisPeriod) => {
          const result = checkSubBillableCeiling({
            subcontractCurrentAmountCents: ceiling,
            previouslyBilledAmountCents: previously,
            thisPeriodAmountCents: thisPeriod,
          });
          const totalAfter = previously + thisPeriod;
          if (totalAfter <= ceiling) {
            expect(result).toEqual({ ok: true, remainingCents: ceiling - totalAfter });
          } else {
            expect(result).toEqual({ ok: false, overageCents: totalAfter - ceiling });
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  // Property-based: doubling all inputs scales remaining/overage linearly.
  // (Sanity check that the invariant is a pure scalar comparison.)
  it('property: doubling all inputs doubles the remaining or overage', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100_000_000 }),
        fc.nat({ max: 100_000_000 }),
        fc.nat({ max: 100_000_000 }),
        (ceiling, previously, thisPeriod) => {
          const single = checkSubBillableCeiling({
            subcontractCurrentAmountCents: ceiling,
            previouslyBilledAmountCents: previously,
            thisPeriodAmountCents: thisPeriod,
          });
          const doubled = checkSubBillableCeiling({
            subcontractCurrentAmountCents: ceiling * 2,
            previouslyBilledAmountCents: previously * 2,
            thisPeriodAmountCents: thisPeriod * 2,
          });
          expect(doubled.ok).toBe(single.ok);
          if (single.ok && doubled.ok) {
            expect(doubled.remainingCents).toBe(single.remainingCents * 2);
          } else if (!single.ok && !doubled.ok) {
            expect(doubled.overageCents).toBe(single.overageCents * 2);
          }
        },
      ),
      { numRuns: 200 },
    );
  });
});
