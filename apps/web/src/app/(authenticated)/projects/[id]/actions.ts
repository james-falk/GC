'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

const AddSovLineInput = z.object({
  projectId: z.string().uuid(),
  lineNumber: z.string().trim().min(1).max(32),
  description: z.string().trim().min(1).max(500),
  contractAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'must be a positive amount with up to 2 decimal places'),
});

export async function addSovLine(formData: FormData) {
  const tenant = await getCurrentTenant();
  const parsed = AddSovLineInput.parse({
    projectId: formData.get('projectId'),
    lineNumber: formData.get('lineNumber'),
    description: formData.get('description'),
    contractAmount: formData.get('contractAmount'),
  });

  // Confirm the project belongs to this tenant before inserting against it.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(and(eq(schema.projects.id, parsed.projectId), eq(schema.projects.tenantId, tenant.id)))
    .limit(1);

  if (!project) {
    throw new Error('Project not found in current tenant');
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
  });

  revalidatePath(`/projects/${parsed.projectId}`);
}
