'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import {
  archiveSwornStatement,
  architectApproveSwornStatement,
  generateSwornStatement,
  markNotarizedSwornStatement,
  ownerApproveSwornStatement,
  sendSwornStatementToArchitect,
  sendSwornStatementToOwner,
  uploadSignedSwornStatement,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ensureCurrentUser } from '@/lib/user';
import {
  buildApproveUrl,
  generateRawToken,
  hashToken,
  resolveBaseUrl,
} from '@/lib/magic-link';
import { notifyMagicLink } from '@/lib/email';

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

  // The generated PDF is rendered on-demand by /api/sworn-statement/[id]
  // — no R2 bytes need to exist. We still create a document_attachments
  // row because sworn_statements.generated_pdf_attachment_id is NOT NULL,
  // and mark the storage_key with `synthetic://` so the Documents tab
  // routes downloads to the render route instead of presigning R2.
  await db.transaction(async (tx) => {
    // Insert the doc first (entity_id placeholder, backfilled below).
    const [docRow] = await tx
      .insert(schema.documentAttachments)
      .values({
        tenantId: tenant.id,
        entityType: 'sworn_statement',
        entityId: payApp.id,
        filename: 'sworn-statement.pdf',
        storageKey: `synthetic://sworn-statement/pending.pdf`,
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

    // Backfill the document's entity_id + storage_key now that we have
    // the sworn_statements id.
    await tx
      .update(schema.documentAttachments)
      .set({
        entityId: ssRow.id,
        storageKey: `synthetic://sworn-statement/${ssRow.id}.pdf`,
      })
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

// Send-to-architect / send-to-owner generate magic-links (architect + owner
// emails resolved from the project). Architect/Owner approve in-app (GC
// confirms manually) — extending /approve/[token] to consume sworn_statement
// targets is a follow-up.

const SWORN_LINK_TTL_HOURS = 168; // 7 days

async function readSwornStatementWithProject(
  ssId: string,
  tenantId: string,
  projectId: string,
) {
  const [row] = await db
    .select({
      id: schema.swornStatements.id,
      status: schema.swornStatements.status,
      projectId: schema.payApplications.projectId,
      projectName: schema.projects.name,
      projectArchitectId: schema.projects.architectId,
      projectOwnerId: schema.projects.ownerId,
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

async function resolveOrgEmail(
  organizationId: string,
  role: 'architect' | 'owner',
): Promise<string> {
  const [org] = await db
    .select({ email: schema.organizations.contactEmail })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, organizationId))
    .limit(1);
  if (!org || !org.email) {
    throw new Error(
      `${role[0]!.toUpperCase() + role.slice(1)} organization has no contact email — add one first.`,
    );
  }
  return org.email;
}

export async function sendToArchitectAction(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = TransitionInput.parse({
    projectId: formData.get('projectId'),
    swornStatementId: formData.get('swornStatementId'),
  });

  const ss = await readSwornStatementWithProject(
    parsed.swornStatementId,
    tenant.id,
    parsed.projectId,
  );
  if (!ss.projectArchitectId) {
    throw new Error(
      'Project has no architect organization attached — set one before sending.',
    );
  }
  const architectEmail = await resolveOrgEmail(ss.projectArchitectId, 'architect');

  const transition = sendSwornStatementToArchitect(
    ss.status as Parameters<typeof sendSwornStatementToArchitect>[0],
    'pending-insert',
  );
  if (!transition.ok) throw new Error(transition.error);

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SWORN_LINK_TTL_HOURS * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.swornStatements)
      .set({ status: 'sent_to_architect' })
      .where(eq(schema.swornStatements.id, ss.id));

    await tx.insert(schema.magicLinks).values({
      tenantId: tenant.id,
      targetEntityType: 'sworn_statement',
      targetEntityId: ss.id,
      recipientEmail: architectEmail,
      recipientRole: 'architect',
      tokenHash,
      action: 'approve_or_reject',
      expiresAt,
    });

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ss.id,
      fromStatus: 'notarized',
      toStatus: 'sent_to_architect',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: `Sent to architect ${architectEmail}`,
    });
  });

  void notifyMagicLink({
    to: architectEmail,
    recipientLabel: 'Architect',
    documentLabel: 'sworn statement',
    projectName: ss.projectName,
    contractorName: tenant.name,
    approvalUrl: buildApproveUrl(rawToken, resolveBaseUrl()),
    expiresInHours: SWORN_LINK_TTL_HOURS,
  });

  const params = new URLSearchParams({
    sentToArchitectToken: rawToken,
  });
  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(
    `/projects/${parsed.projectId}/pay-apps/sworn-statement?${params.toString()}`,
  );
}

export async function architectApproveAction(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = TransitionInput.parse({
    projectId: formData.get('projectId'),
    swornStatementId: formData.get('swornStatementId'),
  });

  const ss = await readSwornStatement(parsed.swornStatementId, tenant.id, parsed.projectId);
  const transition = architectApproveSwornStatement(
    ss.status as Parameters<typeof architectApproveSwornStatement>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.swornStatements)
      .set({ status: 'architect_approved' })
      .where(eq(schema.swornStatements.id, ss.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ss.id,
      fromStatus: 'sent_to_architect',
      toStatus: 'architect_approved',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'Architect approval recorded by GC',
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
}

export async function sendToOwnerAction(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = TransitionInput.parse({
    projectId: formData.get('projectId'),
    swornStatementId: formData.get('swornStatementId'),
  });

  const ss = await readSwornStatementWithProject(
    parsed.swornStatementId,
    tenant.id,
    parsed.projectId,
  );
  if (!ss.projectOwnerId) {
    throw new Error(
      'Project has no owner organization attached — set one before sending.',
    );
  }
  const ownerEmail = await resolveOrgEmail(ss.projectOwnerId, 'owner');

  const transition = sendSwornStatementToOwner(
    ss.status as Parameters<typeof sendSwornStatementToOwner>[0],
    'pending-insert',
  );
  if (!transition.ok) throw new Error(transition.error);

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SWORN_LINK_TTL_HOURS * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.swornStatements)
      .set({ status: 'sent_to_owner' })
      .where(eq(schema.swornStatements.id, ss.id));

    await tx.insert(schema.magicLinks).values({
      tenantId: tenant.id,
      targetEntityType: 'sworn_statement',
      targetEntityId: ss.id,
      recipientEmail: ownerEmail,
      recipientRole: 'owner',
      tokenHash,
      action: 'approve_or_reject',
      expiresAt,
    });

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ss.id,
      fromStatus: 'architect_approved',
      toStatus: 'sent_to_owner',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: `Sent to owner ${ownerEmail}`,
    });
  });

  void notifyMagicLink({
    to: ownerEmail,
    recipientLabel: 'Project Owner',
    documentLabel: 'sworn statement',
    projectName: ss.projectName,
    contractorName: tenant.name,
    approvalUrl: buildApproveUrl(rawToken, resolveBaseUrl()),
    expiresInHours: SWORN_LINK_TTL_HOURS,
  });

  const params = new URLSearchParams({
    sentToOwnerToken: rawToken,
  });
  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(
    `/projects/${parsed.projectId}/pay-apps/sworn-statement?${params.toString()}`,
  );
}

export async function ownerApproveAction(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = TransitionInput.parse({
    projectId: formData.get('projectId'),
    swornStatementId: formData.get('swornStatementId'),
  });

  const ss = await readSwornStatement(parsed.swornStatementId, tenant.id, parsed.projectId);
  const transition = ownerApproveSwornStatement(
    ss.status as Parameters<typeof ownerApproveSwornStatement>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.swornStatements)
      .set({ status: 'owner_approved' })
      .where(eq(schema.swornStatements.id, ss.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ss.id,
      fromStatus: 'sent_to_owner',
      toStatus: 'owner_approved',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'Owner approval recorded by GC',
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
}

export async function archiveAction(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = TransitionInput.parse({
    projectId: formData.get('projectId'),
    swornStatementId: formData.get('swornStatementId'),
  });

  const ss = await readSwornStatement(parsed.swornStatementId, tenant.id, parsed.projectId);
  const transition = archiveSwornStatement(
    ss.status as Parameters<typeof archiveSwornStatement>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.swornStatements)
      .set({ status: 'archived' })
      .where(eq(schema.swornStatements.id, ss.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'sworn_statement',
      entityId: ss.id,
      fromStatus: 'owner_approved',
      toStatus: 'archived',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'Archived',
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
  redirect(`/projects/${parsed.projectId}/pay-apps/sworn-statement`);
}
