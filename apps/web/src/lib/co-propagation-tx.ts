import { eq, sql } from 'drizzle-orm';
import type { PropagationOp } from '@constructor/domain';
import { db, schema } from '@constructor/db';

// Drizzle SQL adapter for @constructor/domain's PropagationOp list.
// Lives here (not in a 'use server' file) so it isn't accidentally
// exposed as an RPC endpoint — anyone calling this directly could
// increment arbitrary subcontracts/SoV lines, which is exactly what
// we want to prevent.

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function applyPropagationOp(tx: Tx, op: PropagationOp): Promise<void> {
  if (op.kind === 'updateChangeOrderApproved') {
    await tx
      .update(schema.changeOrders)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(eq(schema.changeOrders.id, op.changeOrderId));
    return;
  }
  if (op.kind === 'incrementSubcontract') {
    await tx
      .update(schema.subcontracts)
      .set({
        currentAmount: sql`${schema.subcontracts.currentAmount} + ${op.deltaAmount}`,
      })
      .where(eq(schema.subcontracts.id, op.subcontractId));
    return;
  }
  if (op.kind === 'incrementSovLine') {
    await tx
      .update(schema.sovLines)
      .set({
        currentAmount: sql`${schema.sovLines.currentAmount} + ${op.deltaAmount}`,
      })
      .where(eq(schema.sovLines.id, op.sovLineId));
    return;
  }
  // Exhaustiveness — TS yells here if a new op variant lands without a case.
  const _exhaustive: never = op;
  void _exhaustive;
}
