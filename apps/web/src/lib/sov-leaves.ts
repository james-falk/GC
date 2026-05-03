import { and, asc, eq, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '@constructor/db';

// SoV "leaf" lines = lines that don't have any children pointing back at
// them via parent_line_id. When a parent is broken into children, the
// children carry the dollars; the parent becomes a category header that
// must NOT be billed directly. Without this filter a sub could bill the
// parent AND its children, double-counting the work.

export type SovLeafLine = {
  id: string;
  lineNumber: string;
  description: string;
  currentAmount: string;
};

/**
 * Leaf SoV lines for a given subcontract, ordered by line_number. Excludes
 * any row that is a parent of another row in the same project.
 */
export async function leafSovLinesForSubcontract(input: {
  subcontractId: string;
  tenantId: string;
  projectId: string;
}): Promise<SovLeafLine[]> {
  // Subquery: ids of every line that IS a parent of some child.
  const parentIdsSub = db
    .select({ id: schema.sovLines.parentLineId })
    .from(schema.sovLines)
    .where(
      and(
        eq(schema.sovLines.projectId, input.projectId),
        eq(schema.sovLines.tenantId, input.tenantId),
        isNotNull(schema.sovLines.parentLineId),
      ),
    );

  return db
    .select({
      id: schema.sovLines.id,
      lineNumber: schema.sovLines.lineNumber,
      description: schema.sovLines.description,
      currentAmount: schema.sovLines.currentAmount,
    })
    .from(schema.sovLines)
    .where(
      and(
        eq(schema.sovLines.subcontractId, input.subcontractId),
        eq(schema.sovLines.tenantId, input.tenantId),
        sql`${schema.sovLines.id} NOT IN ${parentIdsSub}`,
      ),
    )
    .orderBy(asc(schema.sovLines.lineNumber));
}
