// Atomic CO propagation — pure operation builder.
//
// Per gc-data-model.md § Invariant #4, when a CO transitions to 'approved'
// the system in a single transaction:
//   1. Updates the CO status to approved (+ approvedAt).
//   2. Increments the affected subcontract's current_amount by CO.total.
//   3. For each CO line, increments the matching sov_line's current_amount.
//   4. (Caller adds an approval_event with their actor context.)
//
// This module owns step 1–3 as a pure data transformation: given the CO's
// metadata + lines, it returns a typed list of operations the caller wraps
// in a db.transaction. The caller decides what tx engine to use, what
// table identifiers map to (Drizzle, Prisma, raw SQL — doesn't matter).
//
// Pulling this out of apps/web/.../actions.ts means:
//   - Both PM-direct and magic-link approval paths share one source of
//     truth instead of duplicating SQL.
//   - The operation list is unit-testable without a DB.
//   - Per CLAUDE.md guardrail #1, propagation logic lives in
//     packages/domain.

export type CoPropagationInput = {
  changeOrderId: string;
  /** Total of CO line deltas as a numeric(14,2) dollar string, e.g. "34700.00" */
  totalAmount: string;
  /** May be null for COs with no targeted subcontract (rare in practice). */
  affectedSubcontractId: string | null;
  /** Per-line deltas; deltaAmount may be negative. */
  lines: Array<{ sovLineId: string; deltaAmount: string }>;
};

export type PropagationOp =
  | { kind: 'updateChangeOrderApproved'; changeOrderId: string }
  | {
      kind: 'incrementSubcontract';
      subcontractId: string;
      deltaAmount: string;
    }
  | { kind: 'incrementSovLine'; sovLineId: string; deltaAmount: string };

/**
 * Build the ordered list of operations to execute inside a single
 * transaction. Order matters for diagnostics (CO flip first, then
 * cascading updates) but each op is independent — any reorder still
 * produces the same DB state given a successful commit.
 */
export function buildPropagationOps(input: CoPropagationInput): PropagationOp[] {
  if (input.lines.length === 0) {
    throw new Error('CO has no line items — cannot propagate');
  }

  const ops: PropagationOp[] = [
    { kind: 'updateChangeOrderApproved', changeOrderId: input.changeOrderId },
  ];

  if (input.affectedSubcontractId) {
    ops.push({
      kind: 'incrementSubcontract',
      subcontractId: input.affectedSubcontractId,
      deltaAmount: input.totalAmount,
    });
  }

  for (const line of input.lines) {
    ops.push({
      kind: 'incrementSovLine',
      sovLineId: line.sovLineId,
      deltaAmount: line.deltaAmount,
    });
  }

  return ops;
}
