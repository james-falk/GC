import type { SwornStatementState } from './sworn-statement';
import type { TransitionResult } from './change-order-reducer';

// Pure-function transitions for the SwornStatement state machine.
// See docs/gc-state-machines.md § 4.
//
// Like the SubPayApp reducer, transitions take just the current `kind`
// since the reducer only inspects it.

type SwornStatementKind = SwornStatementState['kind'];

// Initial transition (none → generated). Called when an owner pay-app is
// approved or assembled and the sworn statement is auto-generated.
// Always succeeds; the caller is responsible for ensuring no statement
// exists yet for the parent pay-app.
export function generateSwornStatement(
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  return { ok: true, nextState: { kind: 'generated', at: now } };
}

export function uploadSignedSwornStatement(
  currentKind: SwornStatementKind,
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  if (currentKind !== 'generated') {
    return {
      ok: false,
      error: `cannot upload signed PDF from state '${currentKind}' — must be 'generated'`,
    };
  }
  return { ok: true, nextState: { kind: 'signed', at: now } };
}

export function markNotarizedSwornStatement(
  currentKind: SwornStatementKind,
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  if (currentKind !== 'signed') {
    return {
      ok: false,
      error: `cannot mark notarized from state '${currentKind}' — must be 'signed'`,
    };
  }
  return { ok: true, nextState: { kind: 'notarized', at: now } };
}

export function sendSwornStatementToArchitect(
  currentKind: SwornStatementKind,
  magicLinkId: string,
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  if (currentKind !== 'notarized') {
    return {
      ok: false,
      error: `cannot send to architect from state '${currentKind}' — must be 'notarized'`,
    };
  }
  return {
    ok: true,
    nextState: { kind: 'sent_to_architect', magicLinkId, at: now },
  };
}

export function architectApproveSwornStatement(
  currentKind: SwornStatementKind,
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  if (currentKind !== 'sent_to_architect') {
    return {
      ok: false,
      error: `cannot architect-approve from state '${currentKind}'`,
    };
  }
  return { ok: true, nextState: { kind: 'architect_approved', at: now } };
}

export function sendSwornStatementToOwner(
  currentKind: SwornStatementKind,
  magicLinkId: string,
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  if (currentKind !== 'architect_approved') {
    return {
      ok: false,
      error: `cannot send to owner from state '${currentKind}' — must be 'architect_approved'`,
    };
  }
  return {
    ok: true,
    nextState: { kind: 'sent_to_owner', magicLinkId, at: now },
  };
}

export function ownerApproveSwornStatement(
  currentKind: SwornStatementKind,
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  if (currentKind !== 'sent_to_owner') {
    return {
      ok: false,
      error: `cannot owner-approve from state '${currentKind}'`,
    };
  }
  return { ok: true, nextState: { kind: 'owner_approved', at: now } };
}

export function archiveSwornStatement(
  currentKind: SwornStatementKind,
  now: Date = new Date(),
): TransitionResult<SwornStatementState> {
  if (currentKind !== 'owner_approved') {
    return {
      ok: false,
      error: `cannot archive from state '${currentKind}' — must be 'owner_approved'`,
    };
  }
  return { ok: true, nextState: { kind: 'archived', at: now } };
}
