'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
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
  ownerId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  architectId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function createProject(formData: FormData) {
  const tenant = await getCurrentTenant();
  const parsed = NewProjectInput.parse({
    projectNumber: formData.get('projectNumber'),
    name: formData.get('name'),
    originalContractAmount: formData.get('originalContractAmount'),
    ownerId: formData.get('ownerId'),
    architectId: formData.get('architectId'),
  });

  // If owner/architect were supplied, re-verify they belong to this tenant
  // and have the right type. Both come from form-controlled dropdowns;
  // belt-and-suspenders against tampering.
  const ids = [parsed.ownerId, parsed.architectId].filter(
    (id): id is string => Boolean(id),
  );
  if (ids.length > 0) {
    const valid = await db
      .select({
        id: schema.organizations.id,
        type: schema.organizations.type,
      })
      .from(schema.organizations)
      .where(
        and(
          inArray(schema.organizations.id, ids),
          eq(schema.organizations.tenantId, tenant.id),
        ),
      );
    const byId = new Map(valid.map((v) => [v.id, v.type]));
    if (parsed.ownerId && byId.get(parsed.ownerId) !== 'owner') {
      throw new Error('Owner organization must be type=owner and in this tenant');
    }
    if (parsed.architectId && byId.get(parsed.architectId) !== 'architect') {
      throw new Error('Architect organization must be type=architect and in this tenant');
    }
  }

  const [project] = await db
    .insert(schema.projects)
    .values({
      tenantId: tenant.id,
      projectNumber: parsed.projectNumber,
      name: parsed.name,
      originalContractAmount: parsed.originalContractAmount,
      ownerId: parsed.ownerId ?? null,
      architectId: parsed.architectId ?? null,
    })
    .returning();

  if (!project) {
    throw new Error('Insert returned no row');
  }

  redirect(`/projects/${project.id}`);
}
