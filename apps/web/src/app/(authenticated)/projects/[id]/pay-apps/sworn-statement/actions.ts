'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import {
  generateSwornStatement,
  markNotarizedSwornStatement,
  uploadSignedSwornStatement,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ensureCurrentUser } from '@/lib/user';

// Sworn statement lifecycle actions. Mirrors the AIA pay-app shape:
// generate from a real owner pay-app, advance status as the document
// physically moves through signing → notarization → external review.
//
// Real R2 file uploads land in Round 4. For now uploadSigned just
// transitions state; the file isn't persisted yet.

const GenerateInput = z.object({
  projectId: z.string().uuid(),
  ownerPayAppId: z.string().uuid(),
});

export async function generateSwornStatementAction(
  formData: FormData,
): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = GenerateInput.parse({
    projectId: formData.get('projectId'),
    ownerPayAppId: formData.get('ownerPayAppId'),
  });

  // Verify owner pay-app belongs to this tenant + project + is gc_to_owner
  // + project not archived.
  const [payApp] = await db
    .select({
      id: schema.payApplications.id,
      direction: schema.payApplications.direction,
    })
    .from(schema.payApplications)
    .innerJoin(
      schema.projects,
      and(
        eq(schema.payApplications.projectId, schema.projects.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .where(
      and(
        eq(schema.payApplications.id, parsed.ownerPayAppId),
        eq(schema.payApplications.projectId, parsed.projectId),
        eq(schema.payApplications.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!payApp || payApp.direction !== 'gc_to_owner') {
    throw new Error('Owner pay app not found in this project/tenant');
  }

  // Refuse if a sworn statement already exists for this pay app.
  const existing = await db
    .select({ id: schema.swornStatements.id })
    .from(schema.swornStatements)
    .where(eq(schema.swornStatements.payApplicationId, payApp.id))
    .limit(1);
  if (existing.length > 0) {
    throw new Error(
      'Sworn statement already exists for this owner pay app.',
    );
  }

  // Reducer: always-ok generate.
  const transition = generateSwornStatement();
  if (!transition.ok) throw new Error(transition.error);

  // Sworn statement schema requires generated_pdf_attachment_id (a FK to
  // document_attachments). We don't have R2 wiring yet, so we create a
  // placeholder document_attachments row pointing at a phantom storage
  // key. Real R2 upload pipeline replaces this in Round 4.
  await db.transaction(async (tx) => {
    const [docRow] = await tx
      .insert(schema.documentAttachments)
      .values({
        tenantId: tenant.id,
        entityType: 'sworn_statement',
        entityId: payApp.id, // placeholder linkage; updated post-insert ideally
        filename: 'sworn-statement.pdf',
        storageKey: `placeholder/sworn-statement/${payApp.id}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 0,
        uploadedByUserId: user.id,
      })
      .returning({ id: schema.documentAttachments.id });
    if (!docRow) throw new Error('document_attachments insert returned no row');

    const [ssRow] = await tx
      .insert(schema.swornStatements)
      .values({
        tenantId: tenant.id,
        payApplicationId: payApp.id,
        generatedPdfAttachmentId: docRow.id,
        status: 'generated',
      })
      .returning({ id: schema.swornStatements.id });
    if (!ssRow) throw new Error('sworn_statements insert returned no row');

    // Backfill the document's entity_id to point at the sworn_statements row.
    await tx
      .update(schema.documentAttachments)
      .set({ entityId: ssRow.id })
      .where(eq(schema.documentAttachments.id, docRow.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ssRow.id,
      fromStatus: null,
      toStatus: 'generated',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: `Generated for owner pay app ${payApp.id}`,
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
}

const TransitionInput = z.object({
  projectId: z.string().uuid(),
  swornStatementId: z.string().uuid(),
});

async function readSwornStatement(
  ssId: string,
  tenantId: string,
  projectId: string,
) {
  const [row] = await db
    .select({
      id: schema.swornStatements.id,
      status: schema.swornStatements.status,
    })
    .from(schema.swornStatements)
    .innerJoin(
      schema.payApplications,
      eq(schema.swornStatements.payApplicationId, schema.payApplications.id),
    )
    .innerJoin(
      schema.projects,
      and(
        eq(schema.payApplications.projectId, schema.projects.id),
        isNull(schema.projects.deletedAt),
      ),
    )
    .where(
      and(
        eq(schema.swornStatements.id, ssId),
        eq(schema.swornStatements.tenantId, tenantId),
        eq(schema.payApplications.projectId, projectId),
      ),
    )
    .limit(1);
  if (!row) throw new Error('Sworn statement not found');
  return row;
}

export async function uploadSignedSwornStatementAction(
  formData: FormData,
): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = TransitionInput.parse({
    projectId: formData.get('projectId'),
    swornStatementId: formData.get('swornStatementId'),
  });

  const ss = await readSwornStatement(parsed.swornStatementId, tenant.id, parsed.projectId);
  const transition = uploadSignedSwornStatement(
    ss.status as Parameters<typeof uploadSignedSwornStatement>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.swornStatements)
      .set({ status: 'signed' })
      .where(eq(schema.swornStatements.id, ss.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ss.id,
      fromStatus: 'generated',
      toStatus: 'signed',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'Signed PDF uploaded (R2 wiring lands in Round 4)',
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
}

export async function markNotarizedAction(
  formData: FormData,
): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = TransitionInput.parse({
    projectId: formData.get('projectId'),
    swornStatementId: formData.get('swornStatementId'),
  });

  const ss = await readSwornStatement(parsed.swornStatementId, tenant.id, parsed.projectId);
  const transition = markNotarizedSwornStatement(
    ss.status as Parameters<typeof markNotarizedSwornStatement>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.swornStatements)
      .set({ status: 'notarized' })
      .where(eq(schema.swornStatements.id, ss.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ss.id,
      fromStatus: 'signed',
      toStatus: 'notarized',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'Marked notarized',
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
}
