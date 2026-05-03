import { describe, expect, it } from 'vitest';
import {
  pmApproveSubPayApp,
  pmRequestRevisionSubPayApp,
  rollIntoOwnerPayApp,
  submitSubPayApp,
} from './sub-pay-app-reducer';

describe('submitSubPayApp', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions draft → submitted with timestamp', () => {
    const result = submitSubPayApp('draft', fixedNow);
    expect(result).toEqual({
      ok: true,
      nextState: { kind: 'submitted', submittedAt: fixedNow },
    });
  });

  it('transitions needs_revision → submitted (re-submission)', () => {
    const result = submitSubPayApp('needs_revision', fixedNow);
    expect(result).toEqual({
      ok: true,
      nextState: { kind: 'submitted', submittedAt: fixedNow },
    });
  });

  const badKinds = [
    'submitted',
    'approved_by_pm',
    'approved_by_principal',
    'approved',
    'included_in_owner_pay_app',
    'paid',
    'cancelled',
  ] as const;

  for (const kind of badKinds) {
    it(`rejects submit from kind '${kind}'`, () => {
      const result = submitSubPayApp(kind);
      expect(result.ok).toBe(false);
    });
  }
});

describe('pmApproveSubPayApp', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions submitted → approved', () => {
    const result = pmApproveSubPayApp('submitted', fixedNow);
    expect(result).toEqual({
      ok: true,
      nextState: { kind: 'approved', at: fixedNow },
    });
  });

  const badKinds = [
    'draft',
    'needs_revision',
    'approved_by_pm',
    'approved_by_principal',
    'approved',
    'paid',
    'cancelled',
  ] as const;

  for (const kind of badKinds) {
    it(`rejects approve from kind '${kind}'`, () => {
      const result = pmApproveSubPayApp(kind);
      expect(result.ok).toBe(false);
    });
  }
});

describe('pmRequestRevisionSubPayApp', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions submitted → needs_revision with comment', () => {
    const result = pmRequestRevisionSubPayApp(
      'submitted',
      'percent on line 3a is too high',
      fixedNow,
    );
    expect(result).toEqual({
      ok: true,
      nextState: {
        kind: 'needs_revision',
        comment: 'percent on line 3a is too high',
        at: fixedNow,
      },
    });
  });

  it('requires non-empty comment', () => {
    const result = pmRequestRevisionSubPayApp('submitted', '   ', fixedNow);
    expect(result.ok).toBe(false);
  });

  it('rejects from non-submitted', () => {
    const result = pmRequestRevisionSubPayApp('draft', 'no', fixedNow);
    expect(result.ok).toBe(false);
  });
});

describe('rollIntoOwnerPayApp', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions approved → included_in_owner_pay_app with ownerPayAppId', () => {
    const result = rollIntoOwnerPayApp('approved', 'pa_owner_xyz', fixedNow);
    expect(result).toEqual({
      ok: true,
      nextState: {
        kind: 'included_in_owner_pay_app',
        ownerPayAppId: 'pa_owner_xyz',
        at: fixedNow,
      },
    });
  });

  const badKinds = [
    'draft',
    'submitted',
    'needs_revision',
    'approved_by_pm',
    'approved_by_principal',
    'included_in_owner_pay_app',
    'paid',
    'cancelled',
  ] as const;

  for (const kind of badKinds) {
    it(`rejects roll-up from kind '${kind}'`, () => {
      const result = rollIntoOwnerPayApp(kind, 'pa_x');
      expect(result.ok).toBe(false);
    });
  }
});
