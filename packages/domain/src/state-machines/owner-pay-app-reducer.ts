import type { OwnerPayAppState } from './owner-pay-app';
import type { TransitionResult } from './change-order-reducer';

// Pure-function transitions for the OwnerPayApplication state machine.
// See docs/gc-state-machines.md § 2.
//
// MVP scope: skip the architect intermediate (the sworn statement goes
// through architect; the AIA G702 itself goes straight from GC to owner).
// Path: generated → sent_to_owner → owner_approved → paid. owner_rejected
// branches back to a revisable state.
//
// API choice (consistent with sub-pay-app + change-order reducers): take
// just the current `kind` rather than a full state, so callers can ask
// "is this transition legal?" without constructing placeholder fields.

type OwnerPayAppKind = OwnerPayAppState['kind'];

// GC sends the owner pay-app to the project owner via magic-link.
// Legal from `generated` only.
export function sendOwnerPayAppToOwner(
  currentKind: OwnerPayAppKind,
  magicLinkId: string,
  now: Date = new Date(),
): TransitionResult<OwnerPayAppState> {
  if (currentKind !== 'generated') {
    return {
      ok: false,
      error: `cannot send to owner from state '${currentKind}' — must be 'generated'`,
    };
  }
  return {
    ok: true,
    nextState: { kind: 'sent_to_owner', magicLinkId, at: now },
  };
}

// Owner clicks Approve on their magic-link. Legal from `sent_to_owner`.
export function ownerApproveOwnerPayApp(
  currentKind: OwnerPayAppKind,
  now: Date = new Date(),
): TransitionResult<OwnerPayAppState> {
  if (currentKind !== 'sent_to_owner') {
    return {
      ok: false,
      error: `cannot owner-approve from state '${currentKind}' — must be 'sent_to_owner'`,
    };
  }
  return { ok: true, nextState: { kind: 'owner_approved', at: now } };
}

// Owner clicks Reject on their magic-link. Comment required.
export function ownerRejectOwnerPayApp(
  currentKind: OwnerPayAppKind,
  comment: string,
  now: Date = new Date(),
): TransitionResult<OwnerPayAppState> {
  if (currentKind !== 'sent_to_owner') {
    return {
      ok: false,
      error: `cannot owner-reject from state '${currentKind}' — must be 'sent_to_owner'`,
    };
  }
  if (!comment.trim()) {
    return { ok: false, error: 'rejection comment is required' };
  }
  return {
    ok: true,
    nextState: { kind: 'owner_rejected', comment, at: now },
  };
}

// Finance/PM marks an approved owner pay-app as paid (after the check
// clears the bank). Legal from `owner_approved` only.
export function markOwnerPayAppPaid(
  currentKind: OwnerPayAppKind,
  now: Date = new Date(),
): TransitionResult<OwnerPayAppState> {
  if (currentKind !== 'owner_approved') {
    return {
      ok: false,
      error: `cannot mark paid from state '${currentKind}' — must be 'owner_approved'`,
    };
  }
  return { ok: true, nextState: { kind: 'paid', at: now } };
}
