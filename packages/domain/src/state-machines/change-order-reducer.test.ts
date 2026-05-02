import { describe, expect, it } from 'vitest';
import type { ChangeOrderState } from './change-order';
import {
  approveChangeOrderDirect,
  ownerApproveChangeOrder,
  ownerRejectChangeOrder,
  sendDraftToOwner,
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
