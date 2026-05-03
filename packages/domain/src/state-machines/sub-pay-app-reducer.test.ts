import { describe, expect, it } from 'vitest';
import { submitSubPayApp } from './sub-pay-app-reducer';

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
