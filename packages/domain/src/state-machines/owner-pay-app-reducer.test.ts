import { describe, expect, it } from 'vitest';
import {
  markOwnerPayAppPaid,
  ownerApproveOwnerPayApp,
  ownerRejectOwnerPayApp,
  sendOwnerPayAppToOwner,
} from './owner-pay-app-reducer';

describe('sendOwnerPayAppToOwner', () => {
  it('transitions generated → sent_to_owner with magic-link id', () => {
    const now = new Date('2026-04-01T12:00:00Z');
    const result = sendOwnerPayAppToOwner('generated', 'ml_1', now);
    expect(result).toEqual({
      ok: true,
      nextState: { kind: 'sent_to_owner', magicLinkId: 'ml_1', at: now },
    });
  });

  it('rejects from any other state', () => {
    for (const kind of ['draft', 'signed', 'sent_to_owner', 'paid'] as const) {
      const result = sendOwnerPayAppToOwner(kind, 'ml_1');
      expect(result.ok).toBe(false);
    }
  });
});

describe('ownerApproveOwnerPayApp', () => {
  it('transitions sent_to_owner → owner_approved', () => {
    const result = ownerApproveOwnerPayApp('sent_to_owner');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextState.kind).toBe('owner_approved');
  });

  it('rejects from any other state', () => {
    for (const kind of [
      'generated',
      'owner_approved',
      'paid',
      'owner_rejected',
    ] as const) {
      expect(ownerApproveOwnerPayApp(kind).ok).toBe(false);
    }
  });
});

describe('ownerRejectOwnerPayApp', () => {
  it('transitions sent_to_owner → owner_rejected with comment', () => {
    const result = ownerRejectOwnerPayApp('sent_to_owner', 'numbers off');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.nextState.kind).toBe('owner_rejected');
      if (result.nextState.kind === 'owner_rejected') {
        expect(result.nextState.comment).toBe('numbers off');
      }
    }
  });

  it('rejects empty comment', () => {
    const result = ownerRejectOwnerPayApp('sent_to_owner', '   ');
    expect(result.ok).toBe(false);
  });

  it('rejects from any other state', () => {
    expect(ownerRejectOwnerPayApp('generated', 'no').ok).toBe(false);
  });
});

describe('markOwnerPayAppPaid', () => {
  it('transitions owner_approved → paid', () => {
    const result = markOwnerPayAppPaid('owner_approved');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.nextState.kind).toBe('paid');
  });

  it('rejects from any other state', () => {
    for (const kind of ['sent_to_owner', 'generated', 'paid'] as const) {
      expect(markOwnerPayAppPaid(kind).ok).toBe(false);
    }
  });
});
