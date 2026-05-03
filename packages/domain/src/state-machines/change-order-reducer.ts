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

// PM clicks "Send approval link" on a draft CO — legacy MVP shortcut that
// skips Principal + Architect intermediate steps and routes the link
// straight to the owner. Kept for backwards-compat with existing draft
// COs; new flow uses the full chain via submitCoToPrincipal.
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

// Full chain transitions — Principal in-app + Architect magic-link +
// Owner magic-link. Each takes the current kind only (the reducer
// inspects only kind to decide legality; payload-bearing variants are
// constructed in the next state).

type ChangeOrderKind = ChangeOrderState['kind'];

export function submitCoToPrincipal(
  currentKind: ChangeOrderKind,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (currentKind !== 'draft') {
    return {
      ok: false,
      error: `cannot submit to principal from state '${currentKind}' — must be 'draft'`,
    };
  }
  return { ok: true, nextState: { kind: 'pending_principal', at: now } };
}

export function principalApproveCo(
  currentKind: ChangeOrderKind,
  magicLinkId: string,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (currentKind !== 'pending_principal') {
    return {
      ok: false,
      error: `cannot principal-approve from state '${currentKind}' — must be 'pending_principal'`,
    };
  }
  return {
    ok: true,
    nextState: { kind: 'pending_architect', magicLinkId, at: now },
  };
}

export function principalRejectCo(
  currentKind: ChangeOrderKind,
  comment: string,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (currentKind !== 'pending_principal') {
    return {
      ok: false,
      error: `cannot principal-reject from state '${currentKind}' — must be 'pending_principal'`,
    };
  }
  if (!comment.trim()) {
    return { ok: false, error: 'rejection comment is required' };
  }
  // Principal rejection bounces back to draft per the state-machine spec
  // (PM revises + re-submits). The comment is captured in the audit log,
  // not the state itself, since draft has no comment field.
  return { ok: true, nextState: { kind: 'draft' } };
}

export function architectApproveCo(
  currentKind: ChangeOrderKind,
  magicLinkId: string,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (currentKind !== 'pending_architect') {
    return {
      ok: false,
      error: `cannot architect-approve from state '${currentKind}' — must be 'pending_architect'`,
    };
  }
  return {
    ok: true,
    nextState: { kind: 'pending_owner', magicLinkId, at: now },
  };
}

export function architectRejectCo(
  currentKind: ChangeOrderKind,
  comment: string,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (currentKind !== 'pending_architect') {
    return {
      ok: false,
      error: `cannot architect-reject from state '${currentKind}' — must be 'pending_architect'`,
    };
  }
  if (!comment.trim()) {
    return { ok: false, error: 'rejection comment is required' };
  }
  return {
    ok: true,
    nextState: { kind: 'architect_rejected', comment, at: now },
  };
}

export function pmReviseAfterRejection(
  currentKind: ChangeOrderKind,
): TransitionResult<ChangeOrderState> {
  if (
    currentKind !== 'architect_rejected' &&
    currentKind !== 'owner_rejected'
  ) {
    return {
      ok: false,
      error: `cannot revise from state '${currentKind}' — must be a rejection state`,
    };
  }
  return { ok: true, nextState: { kind: 'draft' } };
}

// Cancel a CO. Legal from every non-terminal state — once a CO has
// propagated (approved) it can't be cancelled, since downstream subcontract
// + SoV totals were already updated. To reverse an approved CO, the user
// issues a counter-CO.
export function cancelChangeOrder(
  currentKind: ChangeOrderKind,
  reason: string,
  now: Date = new Date(),
): TransitionResult<ChangeOrderState> {
  if (currentKind === 'approved') {
    return {
      ok: false,
      error:
        'cannot cancel an approved CO — propagation has already happened. Issue a counter-CO instead.',
    };
  }
  if (currentKind === 'cancelled') {
    return { ok: false, error: 'CO is already cancelled' };
  }
  if (!reason.trim()) {
    return { ok: false, error: 'cancellation reason is required' };
  }
  return { ok: true, nextState: { kind: 'cancelled', reason, at: now } };
}
