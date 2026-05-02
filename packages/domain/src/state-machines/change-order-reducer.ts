import type { ChangeOrderState } from './change-order';

// Pure-function transitions for the ChangeOrder state machine.
// See docs/gc-state-machines.md § 3 for the full transition map.
//
// Current scope: only the draft → approved transition the MVP wedge demo
// uses. The fuller event-driven reducer (covering submit_to_principal,
// architect approve/reject, owner approve/reject, etc.) lands when the
// magic-link external approval chain is wired.

export type TransitionResult<TState> =
  | { ok: true; nextState: TState }
  | { ok: false; error: string };

// PM-direct approval used by the MVP demo before the full
// Principal → Architect → Owner chain exists. When the chain lands,
// this becomes a guard inside the owner_approve branch of the fuller
// reducer, not a top-level entry point.
export function approveChangeOrderDirect(
  state: ChangeOrderState,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (state.kind !== 'draft') {
    return {
      ok: false,
      error: `cannot approve from state '${state.kind}' — must be 'draft'`,
    };
  }
  return { ok: true, nextState: { kind: 'approved', at: now } };
}

// Owner approves via magic-link. Legal from `pending_owner` only.
// This is the transition that triggers atomic propagation — the SQL
// transaction runs only after this returns ok.
export function ownerApproveChangeOrder(
  state: ChangeOrderState,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (state.kind !== 'pending_owner') {
    return {
      ok: false,
      error: `cannot owner-approve from state '${state.kind}' — must be 'pending_owner'`,
    };
  }
  return { ok: true, nextState: { kind: 'approved', at: now } };
}

// Owner rejects via magic-link. Legal from `pending_owner` only.
// Comment is required by the state-machine spec.
export function ownerRejectChangeOrder(
  state: ChangeOrderState,
  comment: string,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (state.kind !== 'pending_owner') {
    return {
      ok: false,
      error: `cannot owner-reject from state '${state.kind}' — must be 'pending_owner'`,
    };
  }
  if (!comment.trim()) {
    return { ok: false, error: 'rejection comment is required' };
  }
  return { ok: true, nextState: { kind: 'owner_rejected', comment, at: now } };
}

// PM clicks "Send approval link" on a draft CO — for the MVP magic-link
// demo we skip the Principal + Architect intermediate steps and route the
// link straight to the owner. When the full chain lands, this transitions
// to pending_principal first; for now it goes straight to pending_owner.
export function sendDraftToOwner(
  state: ChangeOrderState,
  magicLinkId: string,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (state.kind !== 'draft') {
    return {
      ok: false,
      error: `cannot send to owner from state '${state.kind}' — must be 'draft'`,
    };
  }
  return {
    ok: true,
    nextState: { kind: 'pending_owner', magicLinkId, at: now },
  };
}
