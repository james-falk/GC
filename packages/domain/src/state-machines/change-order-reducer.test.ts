import { describe, expect, it } from 'vitest';
import type { ChangeOrderState } from './change-order';
import {
  approveChangeOrderDirect,
  architectApproveCo,
  architectRejectCo,
  cancelChangeOrder,
  ownerApproveChangeOrder,
  ownerRejectChangeOrder,
  pmReviseAfterRejection,
  principalApproveCo,
  principalRejectCo,
  sendDraftToOwner,
  submitCoToPrincipal,
} from './change-order-reducer';

describe('approveChangeOrderDirect', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions draft → approved with the supplied timestamp', () => {
    const result = approveChangeOrderDirect({ kind: 'draft' }, fixedNow);
    expect(result).toEqual({
      ok: true,
      nextState: { kind: 'approved', at: fixedNow },
    });
  });

  // Every non-draft state should reject the transition. Listing each
  // explicitly so the test fails loudly if a new ChangeOrderState variant
  // is added without considering its approval semantics.
  const nonDraftStates: ChangeOrderState[] = [
    { kind: 'pending_principal', at: fixedNow },
    { kind: 'pending_architect', magicLinkId: 'ml_x', at: fixedNow },
    { kind: 'architect_rejected', comment: 'not yet', at: fixedNow },
    { kind: 'pending_owner', magicLinkId: 'ml_y', at: fixedNow },
    { kind: 'owner_rejected', comment: 'no', at: fixedNow },
    { kind: 'approved', at: fixedNow },
    { kind: 'cancelled', reason: 'PM withdrew', at: fixedNow },
  ];

  for (const state of nonDraftStates) {
    it(`rejects approval from state '${state.kind}'`, () => {
      const result = approveChangeOrderDirect(state, fixedNow);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain(state.kind);
      }
    });
  }

  it('uses Date.now() when no timestamp is supplied', () => {
    const before = new Date();
    const result = approveChangeOrderDirect({ kind: 'draft' });
    const after = new Date();
    expect(result.ok).toBe(true);
    if (result.ok && result.nextState.kind === 'approved') {
      expect(result.nextState.at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.nextState.at.getTime()).toBeLessThanOrEqual(after.getTime());
    }
  });
});

describe('sendDraftToOwner', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions draft → pending_owner with the magic-link id', () => {
    const result = sendDraftToOwner({ kind: 'draft' }, 'ml_abc', fixedNow);
    expect(result).toEqual({
      ok: true,
      nextState: { kind: 'pending_owner', magicLinkId: 'ml_abc', at: fixedNow },
    });
  });

  it('rejects from non-draft', () => {
    const result = sendDraftToOwner(
      { kind: 'approved', at: fixedNow },
      'ml_abc',
      fixedNow,
    );
    expect(result.ok).toBe(false);
  });
});

describe('ownerApproveChangeOrder', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions pending_owner → approved', () => {
    const result = ownerApproveChangeOrder(
      { kind: 'pending_owner', magicLinkId: 'ml_abc', at: fixedNow },
      fixedNow,
    );
    expect(result).toEqual({
      ok: true,
      nextState: { kind: 'approved', at: fixedNow },
    });
  });

  const badStates: ChangeOrderState[] = [
    { kind: 'draft' },
    { kind: 'pending_principal', at: fixedNow },
    { kind: 'pending_architect', magicLinkId: 'ml_x', at: fixedNow },
    { kind: 'architect_rejected', comment: 'no', at: fixedNow },
    { kind: 'owner_rejected', comment: 'no', at: fixedNow },
    { kind: 'approved', at: fixedNow },
    { kind: 'cancelled', reason: 'PM withdrew', at: fixedNow },
  ];

  for (const state of badStates) {
    it(`rejects approval from state '${state.kind}'`, () => {
      const result = ownerApproveChangeOrder(state, fixedNow);
      expect(result.ok).toBe(false);
    });
  }
});

describe('ownerRejectChangeOrder', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('transitions pending_owner → owner_rejected with the comment', () => {
    const result = ownerRejectChangeOrder(
      { kind: 'pending_owner', magicLinkId: 'ml_abc', at: fixedNow },
      'budget exceeds approved scope',
      fixedNow,
    );
    expect(result).toEqual({
      ok: true,
      nextState: {
        kind: 'owner_rejected',
        comment: 'budget exceeds approved scope',
        at: fixedNow,
      },
    });
  });

  it('requires a non-empty comment', () => {
    const result = ownerRejectChangeOrder(
      { kind: 'pending_owner', magicLinkId: 'ml_abc', at: fixedNow },
      '   ',
      fixedNow,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/comment is required/);
  });

  it('rejects from non-pending_owner', () => {
    const result = ownerRejectChangeOrder({ kind: 'draft' }, 'no', fixedNow);
    expect(result.ok).toBe(false);
  });
});

describe('full CO chain transitions', () => {
  const fixedNow = new Date('2026-05-01T12:00:00.000Z');

  it('submitCoToPrincipal: draft → pending_principal', () => {
    expect(submitCoToPrincipal('draft', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'pending_principal', at: fixedNow },
    });
  });

  it('submitCoToPrincipal rejects from non-draft', () => {
    expect(submitCoToPrincipal('approved', fixedNow).ok).toBe(false);
  });

  it('principalApproveCo: pending_principal → pending_architect with magicLinkId', () => {
    expect(principalApproveCo('pending_principal', 'ml_arch', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'pending_architect', magicLinkId: 'ml_arch', at: fixedNow },
    });
  });

  it('principalApproveCo rejects from non-pending_principal', () => {
    expect(principalApproveCo('draft', 'ml_x', fixedNow).ok).toBe(false);
  });

  it('principalRejectCo: pending_principal → draft (with comment captured externally)', () => {
    expect(principalRejectCo('pending_principal', 'budget exceeds', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'draft' },
    });
  });

  it('principalRejectCo requires comment', () => {
    expect(principalRejectCo('pending_principal', '   ', fixedNow).ok).toBe(false);
  });

  it('architectApproveCo: pending_architect → pending_owner', () => {
    expect(architectApproveCo('pending_architect', 'ml_owner', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'pending_owner', magicLinkId: 'ml_owner', at: fixedNow },
    });
  });

  it('architectRejectCo: pending_architect → architect_rejected with comment', () => {
    expect(architectRejectCo('pending_architect', 'spec issue', fixedNow)).toEqual({
      ok: true,
      nextState: { kind: 'architect_rejected', comment: 'spec issue', at: fixedNow },
    });
  });

  it('architectRejectCo requires comment', () => {
    expect(architectRejectCo('pending_architect', '', fixedNow).ok).toBe(false);
  });

  it('pmReviseAfterRejection: architect_rejected → draft', () => {
    expect(pmReviseAfterRejection('architect_rejected')).toEqual({
      ok: true,
      nextState: { kind: 'draft' },
    });
  });

  it('pmReviseAfterRejection: owner_rejected → draft', () => {
    expect(pmReviseAfterRejection('owner_rejected')).toEqual({
      ok: true,
      nextState: { kind: 'draft' },
    });
  });

  it('pmReviseAfterRejection rejects from non-rejection state', () => {
    expect(pmReviseAfterRejection('draft').ok).toBe(false);
  });
});

describe('cancelChangeOrder', () => {
  const cancellable = [
    'draft',
    'pending_principal',
    'pending_architect',
    'pending_owner',
    'architect_rejected',
    'owner_rejected',
  ] as const;

  for (const kind of cancellable) {
    it(`transitions ${kind} → cancelled with reason`, () => {
      const result = cancelChangeOrder(kind, 'scope removed by owner');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.nextState.kind).toBe('cancelled');
        if (result.nextState.kind === 'cancelled') {
          expect(result.nextState.reason).toBe('scope removed by owner');
        }
      }
    });
  }

  it('rejects cancellation of an approved CO', () => {
    expect(cancelChangeOrder('approved', 'oops').ok).toBe(false);
  });

  it('rejects empty reason', () => {
    expect(cancelChangeOrder('draft', '   ').ok).toBe(false);
  });

  it('rejects double-cancel', () => {
    expect(cancelChangeOrder('cancelled', 'x').ok).toBe(false);
  });
});
