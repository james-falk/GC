'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
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
