import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { dollarsStringToCents } from '@/lib/money';

// Per-project KPIs. Stored as integer cents internally so the rollups
// stay exact. Returns numbers (dollars) for display since the UI never
// runs arithmetic on these — only formats them.
//
// Empty state semantics:
//   - originalContractAmount is always set (NOT NULL on projects).
//   - Approved CO total may be 0 (no COs yet). Delta = 0.
//   - Billed total may be 0 (no paid pay-apps yet). Percent = 0.
//   - Counts are always ≥ 0.
// So every field is well-defined; no NaN, no nulls. UI guards percent
// against divide-by-zero (originalContractAmount can't be 0 because
// validation requires positive at create time, but defensive guard
// is still cheap).

export type ProjectKpis = {
  originalContractDollars: number;
  approvedCoDeltaDollars: number;
  currentContractDollars: number;
  billedToDateDollars: number;
  percentBilled: number; // 0–100, 0 when no contract value
  openCoCount: number;
  subcontractCount: number;
  payAppsAwaitingCount: number;
};

const FINALIZED_OWNER_PAY_APP_STATUSES = ['owner_approved', 'paid'] as const;

export async function getProjectKpis(input: {
  projectId: string;
  tenantId: string;
  originalContractAmount: string;
}): Promise<ProjectKpis> {
  const [
    approvedCoSum,
    billedSum,
    openCos,
    subs,
    awaiting,
  ] = await Promise.all([
    // Sum of approved CO totals. coalesce() handles the "no rows yet" case
    // by returning 0 instead of NULL.
    db
      .select({
        total: sql<string>`coalesce(sum(${schema.changeOrders.totalAmount}), 0)`,
      })
      .from(schema.changeOrders)
      .where(
        and(
          eq(schema.changeOrders.projectId, input.projectId),
          eq(schema.changeOrders.tenantId, input.tenantId),
          eq(schema.changeOrders.status, 'approved'),
        ),
      ),
    // Billed = owner-approved or paid gc_to_owner pay apps. Pre-approval
    // pay apps don't count — their numbers can still move.
    db
      .select({
        total: sql<string>`coalesce(sum(${schema.payApplications.totalBilled}), 0)`,
      })
      .from(schema.payApplications)
      .where(
        and(
          eq(schema.payApplications.projectId, input.projectId),
          eq(schema.payApplications.tenantId, input.tenantId),
          eq(schema.payApplications.direction, 'gc_to_owner'),
          inArray(schema.payApplications.status, [...FINALIZED_OWNER_PAY_APP_STATUSES]),
        ),
      ),
    db
      .select({ value: count() })
      .from(schema.changeOrders)
      .where(
        and(
          eq(schema.changeOrders.projectId, input.projectId),
          eq(schema.changeOrders.tenantId, input.tenantId),
          inArray(schema.changeOrders.status, [
            'pending_principal',
            'pending_architect',
            'pending_owner',
          ]),
        ),
      ),
    db
      .select({ value: count() })
      .from(schema.subcontracts)
      .where(
        and(
          eq(schema.subcontracts.projectId, input.projectId),
          eq(schema.subcontracts.tenantId, input.tenantId),
        ),
      ),
    // Pay apps "on your desk" for this project — sub_to_gc submitted
    // (need GC review) plus gc_to_owner sent_to_owner (waiting on owner).
    db
      .select({ value: count() })
      .from(schema.payApplications)
      .where(
        and(
          eq(schema.payApplications.projectId, input.projectId),
          eq(schema.payApplications.tenantId, input.tenantId),
          inArray(schema.payApplications.status, ['submitted', 'sent_to_owner']),
        ),
      ),
  ]);

  const originalCents = dollarsStringToCents(input.originalContractAmount);
  const approvedCoCents = dollarsStringToCents(
    approvedCoSum[0]?.total ?? '0',
  );
  const billedCents = dollarsStringToCents(billedSum[0]?.total ?? '0');
  const currentCents = originalCents + approvedCoCents;

  const percentBilled =
    currentCents > 0 ? Math.round((billedCents / currentCents) * 1000) / 10 : 0;

  return {
    originalContractDollars: originalCents / 100,
    approvedCoDeltaDollars: approvedCoCents / 100,
    currentContractDollars: currentCents / 100,
    billedToDateDollars: billedCents / 100,
    percentBilled,
    openCoCount: openCos[0]?.value ?? 0,
    subcontractCount: subs[0]?.value ?? 0,
    payAppsAwaitingCount: awaiting[0]?.value ?? 0,
  };
}
