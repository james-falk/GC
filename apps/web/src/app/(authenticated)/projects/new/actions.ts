'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

const NewProjectInput = z.object({
  projectNumber: z.string().trim().min(1, 'required').max(64),
  name: z.string().trim().min(1, 'required').max(200),
  // numeric(14,2) — accept "1234" or "1234.56", store as canonical string for Drizzle.
  originalContractAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'must be a positive amount with up to 2 decimal places'),
});

export async function createProject(formData: FormData) {
  const tenant = await getCurrentTenant();
  const parsed = NewProjectInput.parse({
    projectNumber: formData.get('projectNumber'),
    name: formData.get('name'),
    originalContractAmount: formData.get('originalContractAmount'),
  });

  const [project] = await db
    .insert(schema.projects)
    .values({
      tenantId: tenant.id,
      projectNumber: parsed.projectNumber,
      name: parsed.name,
      originalContractAmount: parsed.originalContractAmount,
    })
    .returning();

  if (!project) {
    throw new Error('Insert returned no row');
  }

  redirect(`/projects/${project.id}`);
}
