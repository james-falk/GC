import type { SubPayAppState } from './sub-pay-app';
import type { TransitionResult } from './change-order-reducer';

// Pure-function transitions for the SubPayApplication state machine.
// See docs/gc-state-machines.md § 1.
//
// API choice: transitions take just the current `kind` (a string from the
// state's discriminator) rather than a full SubPayAppState. The reducer
// only inspects the kind to decide legality; forcing callers to construct
// a full state with placeholder fields (comment, timestamps) just to ask
// "is this transition legal?" is friction without value.

type SubPayAppKind = SubPayAppState['kind'];

// Sub clicks Submit on the magic-link portal. Legal from `draft` or
// `needs_revision` (both allow re-submission).
export function submitSubPayApp(
  currentKind: SubPayAppKind,
  now: Date = new Date(),
): TransitionResult<SubPayAppState> {
  if (currentKind !== 'draft' && currentKind !== 'needs_revision') {
    return {
      ok: false,
      error: `cannot submit from state '${currentKind}' — must be 'draft' or 'needs_revision'`,
    };
  }
  return { ok: true, nextState: { kind: 'submitted', submittedAt: now } };
}

// PM clicks Approve on a submitted sub pay-app. For MVP we go straight
// from `submitted` to `approved` (skipping the `approved_by_pm` /
// `approved_by_principal` two-step which kicks in once a Principal review
// threshold is wired). Full state machine in docs/gc-state-machines.md § 1.
export function pmApproveSubPayApp(
  currentKind: SubPayAppKind,
  now: Date = new Date(),
): TransitionResult<SubPayAppState> {
  if (currentKind !== 'submitted') {
    return {
      ok: false,
      error: `cannot approve from state '${currentKind}' — must be 'submitted'`,
    };
  }
  return { ok: true, nextState: { kind: 'approved', at: now } };
}

// PM clicks Request Revision on a submitted sub pay-app. Comment required
// per the state-machine spec.
export function pmRequestRevisionSubPayApp(
  currentKind: SubPayAppKind,
  comment: string,
  now: Date = new Date(),
): TransitionResult<SubPayAppState> {
  if (currentKind !== 'submitted') {
    return {
      ok: false,
      error: `cannot request revision from state '${currentKind}' — must be 'submitted'`,
    };
  }
  if (!comment.trim()) {
    return { ok: false, error: 'revision comment is required' };
  }
  return {
    ok: true,
    nextState: { kind: 'needs_revision', comment, at: now },
  };
}

// System rolls an approved sub pay-app into a freshly-assembled owner
// pay-app for the same period. Legal from `approved` only.
export function rollIntoOwnerPayApp(
  currentKind: SubPayAppKind,
  ownerPayAppId: string,
  now: Date = new Date(),
): TransitionResult<SubPayAppState> {
  if (currentKind !== 'approved') {
    return {
      ok: false,
      error: `cannot roll into owner pay app from state '${currentKind}' — must be 'approved'`,
    };
  }
  return {
    ok: true,
    nextState: { kind: 'included_in_owner_pay_app', ownerPayAppId, at: now },
  };
}
