'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Step 2 of the backend persistence pass: create a subcontract attached to
// a project + subcontractor. Minimal fields per the user decision — spec
// sections, inclusions, exclusions, signed contract attachment all deferred.
//
// current_amount is initialized to original_amount; it diverges only when
// approved COs propagate (later step).

const NewSubcontractInput = z.object({
  projectId: z.string().uuid(),
  subcontractorId: z.string().uuid('pick a subcontractor'),
  contractNumber: z.string().trim().min(1, 'required').max(64),
  originalAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'must be a positive amount with up to 2 decimal places'),
  status: z.enum(['draft', 'active', 'closed']),
});

export async function createSubcontract(formData: FormData) {
  const tenant = await getCurrentTenant();

  const parsed = NewSubcontractInput.parse({
    projectId: formData.get('projectId'),
    subcontractorId: formData.get('subcontractorId'),
    contractNumber: formData.get('contractNumber'),
    originalAmount: formData.get('originalAmount'),
    status: formData.get('status'),
  });

  // Confirm both the project and the subcontractor belong to this tenant
  // before inserting. Belt-and-suspenders against tampering: the form
  // hidden field could be edited client-side, so we re-check ownership.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!project) {
    throw new Error('Project not found in current tenant');
  }

  const [sub] = await db
    .select({ id: schema.subcontractors.id })
    .from(schema.subcontractors)
    .where(
      and(
        eq(schema.subcontractors.id, parsed.subcontractorId),
        eq(schema.subcontractors.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!sub) {
    throw new Error('Subcontractor not found in current tenant');
  }

  await db.insert(schema.subcontracts).values({
    tenantId: tenant.id,
    projectId: parsed.projectId,
    subcontractorId: parsed.subcontractorId,
    contractNumber: parsed.contractNumber,
    originalAmount: parsed.originalAmount,
    currentAmount: parsed.originalAmount,
    status: parsed.status,
  });

  revalidatePath(`/projects/${parsed.projectId}/subs`);
  redirect(`/projects/${parsed.projectId}/subs`);
}
