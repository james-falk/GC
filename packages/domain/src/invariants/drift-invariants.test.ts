import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { checkSovIntegrity } from './sov-integrity';
import { checkPayAppRollup } from './pay-app-rollup';
import { checkCoPropagation } from './co-not-propagated';
import { checkRetentionBalance } from './retention-balance';

describe('checkSovIntegrity', () => {
  it('ok when sum matches original + approved CO total', () => {
    expect(
      checkSovIntegrity({
        projectOriginalAmountCents: 1_000_00,
        approvedCoTotalCents: 50_00,
        parentSovLineSumCents: 1_050_00,
      }),
    ).toEqual({ ok: true });
  });

  it('flags drift with gap', () => {
    const r = checkSovIntegrity({
      projectOriginalAmountCents: 1_000_00,
      approvedCoTotalCents: 50_00,
      parentSovLineSumCents: 1_049_00, // 1 dollar short
    });
    expect(r).toEqual({
      ok: false,
      expectedCents: 1_050_00,
      actualCents: 1_049_00,
      gapCents: -100,
    });
  });

  it('property: ok iff actual === expected', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10_000_000_00 }),
        fc.nat({ max: 1_000_000_00 }),
        fc.nat({ max: 11_000_000_00 }),
        (orig, co, sumLines) => {
          const r = checkSovIntegrity({
            projectOriginalAmountCents: orig,
            approvedCoTotalCents: co,
            parentSovLineSumCents: sumLines,
          });
          if (sumLines === orig + co) {
            expect(r).toEqual({ ok: true });
          } else {
            expect(r.ok).toBe(false);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it('rejects non-integer inputs', () => {
    expect(() =>
      checkSovIntegrity({
        projectOriginalAmountCents: 100.5,
        approvedCoTotalCents: 0,
        parentSovLineSumCents: 100,
      }),
    ).toThrow(/integer cents/);
  });
});

describe('checkPayAppRollup', () => {
  it('ok when within default 1-cent tolerance', () => {
    expect(
      checkPayAppRollup({
        approvedSubBilledCents: 200_000_00,
        gcInternalBilledCents: 30_000_00,
        ownerPayAppBilledCents: 230_000_01, // 1c off, within tolerance
      }),
    ).toEqual({ ok: true });
  });

  it('flags rollup drift outside tolerance', () => {
    const r = checkPayAppRollup({
      approvedSubBilledCents: 200_000_00,
      gcInternalBilledCents: 30_000_00,
      ownerPayAppBilledCents: 229_000_00, // off by $1,000
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.gapCents).toBe(-100_000);
  });

  it('respects custom tolerance', () => {
    const r = checkPayAppRollup({
      approvedSubBilledCents: 1_000_00,
      gcInternalBilledCents: 0,
      ownerPayAppBilledCents: 999_50, // 50 cents off
      toleranceCents: 100, // 1 dollar tolerance
    });
    expect(r.ok).toBe(true);
  });

  it('rejects negative tolerance', () => {
    expect(() =>
      checkPayAppRollup({
        approvedSubBilledCents: 0,
        gcInternalBilledCents: 0,
        ownerPayAppBilledCents: 0,
        toleranceCents: -1,
      }),
    ).toThrow(/non-negative/);
  });
});

describe('checkCoPropagation', () => {
  it('ok when actual matches expected', () => {
    expect(
      checkCoPropagation({
        subcontractExpectedCurrentCents: 611_322_00,
        subcontractActualCurrentCents: 611_322_00,
      }),
    ).toEqual({ ok: true });
  });

  it('flags non-propagation when actual lags', () => {
    // Approved CO added $34,700 but subcontract.current_amount still
    // shows the pre-CO value.
    const r = checkCoPropagation({
      subcontractExpectedCurrentCents: 611_322_00, // $576,622 + $34,700
      subcontractActualCurrentCents: 576_622_00,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.gapCents).toBe(-34_700_00);
    }
  });
});

describe('checkRetentionBalance', () => {
  it('ok when sub + owner retention totals match within tolerance', () => {
    expect(
      checkRetentionBalance({
        subRetentionCents: 26_831_33,
        ownerRetentionCents: 26_831_33,
      }),
    ).toEqual({ ok: true });
  });

  it('flags retention drift', () => {
    const r = checkRetentionBalance({
      subRetentionCents: 26_831_33,
      ownerRetentionCents: 26_000_00, // $831 dropped
      toleranceCents: 100,
    });
    expect(r.ok).toBe(false);
  });
});
