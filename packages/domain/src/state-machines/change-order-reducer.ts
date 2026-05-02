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
