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
