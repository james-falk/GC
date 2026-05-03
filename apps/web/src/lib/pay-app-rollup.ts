import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { db, schema } from '@constructor/db';

// Helpers shared between the sub portal and the GC review action so both
// see the same "previously billed" picture.
//
// "Previously billed" = sum of `this_period_amount` across pay-app lines
// belonging to the same subcontract whose pay-app has reached a finalized
// state (approved → included → paid). Drafts, submissions awaiting review,
// and revisions in flight are deliberately excluded — those numbers can
// still move.

const FINALIZED_STATUSES = ['approved', 'included_in_owner_pay_app', 'paid'] as const;

/**
 * Returns a Map<sovLineId, billedDollars> covering every prior finalized
 * pay-app line for the given subcontract, optionally excluding a single
 * pay-app id (the one currently being filled / reviewed).
 */
export async function previouslyBilledByLineForSubcontract(input: {
  subcontractId: string;
  tenantId: string;
  excludePayAppId?: string;
}): Promise<Map<string, number>> {
  const conditions = [
    eq(schema.payApplications.subcontractId, input.subcontractId),
    eq(schema.payApplications.tenantId, input.tenantId),
    inArray(schema.payApplications.status, [...FINALIZED_STATUSES]),
  ];
  if (input.excludePayAppId) {
    conditions.push(ne(schema.payApplications.id, input.excludePayAppId));
  }

  const rows = await db
    .select({
      sovLineId: schema.payApplicationLines.sovLineId,
      total: sql<string>`coalesce(sum(${schema.payApplicationLines.thisPeriodAmount}), 0)`,
    })
    .from(schema.payApplicationLines)
    .innerJoin(
      schema.payApplications,
      eq(schema.payApplicationLines.payApplicationId, schema.payApplications.id),
    )
    .where(and(...conditions))
    .groupBy(schema.payApplicationLines.sovLineId);

  const map = new Map<string, number>();
  for (const r of rows) {
    map.set(r.sovLineId, Number(r.total));
  }
  return map;
}
