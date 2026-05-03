'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Project lifecycle actions: archive (soft delete) + restore.
// Hard delete intentionally not exposed — project rows are referenced by
// many entities (subcontracts, sov_lines, change_orders, pay_applications);
// hard delete would either cascade dangerously or fail noisily. Soft
// delete is the only safe operation.

const ArchiveProjectInput = z.object({
  projectId: z.string().uuid(),
});

export async function archiveProject(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const parsed = ArchiveProjectInput.parse({
    projectId: formData.get('projectId'),
  });

  await db
    .update(schema.projects)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
      ),
    );

  revalidatePath('/projects');
  redirect('/projects');
}

export async function restoreProject(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const parsed = ArchiveProjectInput.parse({
    projectId: formData.get('projectId'),
  });

  await db
    .update(schema.projects)
    .set({ deletedAt: null })
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
      ),
    );

  revalidatePath('/projects');
  redirect(`/projects/${parsed.projectId}`);
}

const UpdateProjectInput = z.object({
  projectId: z.string().uuid(),
  projectNumber: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  originalContractAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, 'must be a positive amount with up to 2 decimal places'),
  status: z.enum(['draft', 'active', 'on_hold', 'closed']),
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

export async function updateProject(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const parsed = UpdateProjectInput.parse({
    projectId: formData.get('projectId'),
    projectNumber: formData.get('projectNumber'),
    name: formData.get('name'),
    originalContractAmount: formData.get('originalContractAmount'),
    status: formData.get('status'),
    ownerId: formData.get('ownerId'),
    architectId: formData.get('architectId'),
  });

  // Verify project belongs to tenant + is active.
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
    throw new Error('Project not found in this tenant or has been archived');
  }

  // Re-verify owner + architect organizations belong to this tenant with the
  // right type — same belt-and-suspenders pattern as createProject.
  const orgIds = [parsed.ownerId, parsed.architectId].filter(
    (id): id is string => Boolean(id),
  );
  if (orgIds.length > 0) {
    const orgs = await db
      .select({
        id: schema.organizations.id,
        type: schema.organizations.type,
      })
      .from(schema.organizations)
      .where(
        and(
          inArray(schema.organizations.id, orgIds),
          eq(schema.organizations.tenantId, tenant.id),
        ),
      );
    const byId = new Map(orgs.map((o) => [o.id, o.type]));
    if (parsed.ownerId && byId.get(parsed.ownerId) !== 'owner') {
      throw new Error('Owner organization must be type=owner and in this tenant');
    }
    if (parsed.architectId && byId.get(parsed.architectId) !== 'architect') {
      throw new Error('Architect organization must be type=architect and in this tenant');
    }
  }

  await db
    .update(schema.projects)
    .set({
      projectNumber: parsed.projectNumber,
      name: parsed.name,
      originalContractAmount: parsed.originalContractAmount,
      status: parsed.status,
      ownerId: parsed.ownerId ?? null,
      architectId: parsed.architectId ?? null,
    })
    .where(eq(schema.projects.id, parsed.projectId));

  revalidatePath('/projects');
  revalidatePath(`/projects/${parsed.projectId}`);
  redirect(`/projects/${parsed.projectId}`);
}
