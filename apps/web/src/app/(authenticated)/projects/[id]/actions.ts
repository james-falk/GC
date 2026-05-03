'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// SoV add-line. subcontractId is optional — NULL means a GC-internal cost
// line (bonding, permits, OH&P) with no subcontractor attached. When a
// value is provided we re-verify it belongs to the same project + tenant
// to prevent cross-project linking via a tampered form.

const AddSovLineInput = z.object({
  projectId: z.string().uuid(),
  lineNumber: z.string().trim().min(1).max(32),
  description: z.string().trim().min(1).max(500),
  contractAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'must be a positive amount with up to 2 decimal places'),
  subcontractId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  parentLineId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function addSovLine(formData: FormData) {
  const tenant = await getCurrentTenant();
  const parsed = AddSovLineInput.parse({
    projectId: formData.get('projectId'),
    lineNumber: formData.get('lineNumber'),
    description: formData.get('description'),
    contractAmount: formData.get('contractAmount'),
    subcontractId: formData.get('subcontractId'),
    parentLineId: formData.get('parentLineId'),
  });

  // Confirm the project belongs to this tenant AND isn't archived before
  // inserting against it.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .limit(1);

  if (!project) {
    throw new Error('Project not found in current tenant or has been archived');
  }

  // If a subcontract was picked, verify it belongs to this project + tenant.
  if (parsed.subcontractId) {
    const [sub] = await db
      .select({ id: schema.subcontracts.id })
      .from(schema.subcontracts)
      .where(
        and(
          eq(schema.subcontracts.id, parsed.subcontractId),
          eq(schema.subcontracts.projectId, parsed.projectId),
          eq(schema.subcontracts.tenantId, tenant.id),
        ),
      )
      .limit(1);
    if (!sub) {
      throw new Error('Subcontract not found on this project');
    }
  }

  // If a parent line was picked, verify it belongs to this same project +
  // tenant AND is itself a top-level line (parent_line_id IS NULL). Only
  // a single level of nesting is supported — that matches Spartan's "3a/3b"
  // pattern and avoids the renderer needing to think about deeper trees.
  if (parsed.parentLineId) {
    const [parent] = await db
      .select({ parentLineId: schema.sovLines.parentLineId })
      .from(schema.sovLines)
      .where(
        and(
          eq(schema.sovLines.id, parsed.parentLineId),
          eq(schema.sovLines.projectId, parsed.projectId),
          eq(schema.sovLines.tenantId, tenant.id),
        ),
      )
      .limit(1);
    if (!parent) {
      throw new Error('Parent SoV line not found on this project');
    }
    if (parent.parentLineId !== null) {
      throw new Error(
        'Cannot nest under a child line — parent must be a top-level SoV line',
      );
    }
  }

  await db.insert(schema.sovLines).values({
    tenantId: tenant.id,
    projectId: parsed.projectId,
    lineNumber: parsed.lineNumber,
    description: parsed.description,
    contractAmount: parsed.contractAmount,
    // current_amount tracks the running value after CO adjustments — initialized
    // to the original contract amount and updated atomically on CO approval.
    currentAmount: parsed.contractAmount,
    subcontractId: parsed.subcontractId ?? null,
    parentLineId: parsed.parentLineId ?? null,
  });

  revalidatePath(`/projects/${parsed.projectId}`);
}
