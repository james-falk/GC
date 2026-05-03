'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, isNull } from 'drizzle-orm';
import {
  pmApproveSubPayApp,
  pmRequestRevisionSubPayApp,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ensureCurrentUser } from '@/lib/user';
import { generateRawToken, hashToken } from '@/lib/magic-link';

// Pay-app lifecycle actions for sub_to_gc + gc_to_owner pay applications.
// startMonthlyPayApp opens a pay-app cycle for a project + period. For each
// active subcontract on the project, it creates a `pay_applications` row
// (direction=sub_to_gc, status=draft) plus a single-use magic_link the sub
// uses to fill in their numbers. The raw URLs are returned in the redirect
// so the GC can copy them (until Resend email lands in Round 4).
//
// approveSubPayApp + requestRevision land in Round 2b alongside the sub
// pay-app reducer.
//
// assembleOwnerPayApp lands in Round 2c.

const MAGIC_LINK_TTL_HOURS = 72;

const StartMonthlyPayAppInput = z.object({
  projectId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
});

export async function startMonthlyPayApp(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const parsed = StartMonthlyPayAppInput.parse({
    projectId: formData.get('projectId'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
  });

  if (parsed.periodStart > parsed.periodEnd) {
    throw new Error('Period start must be on or before period end');
  }

  // Project must belong to this tenant and not be archived.
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
  if (!project) throw new Error('Project not found in current tenant or has been archived');

  // Don't double-start: if any sub_to_gc pay app already exists for this
  // exact period, refuse. The user can cancel/delete and retry, or pick a
  // different period.
  const existing = await db
    .select({ id: schema.payApplications.id })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.projectId, parsed.projectId),
        eq(schema.payApplications.tenantId, tenant.id),
        eq(schema.payApplications.direction, 'sub_to_gc'),
        eq(schema.payApplications.periodStart, parsed.periodStart),
        eq(schema.payApplications.periodEnd, parsed.periodEnd),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    throw new Error(
      'A sub pay-app cycle already exists for this period. Use the existing pay apps or pick a different period.',
    );
  }

  // Find every active subcontract on this project, joined to its
  // subcontractor for the recipient email.
  const subs = await db
    .select({
      subcontractId: schema.subcontracts.id,
      subcontractorEmail: schema.subcontractors.contactEmail,
      subcontractorName: schema.subcontractors.name,
      contractNumber: schema.subcontracts.contractNumber,
    })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(
      and(
        eq(schema.subcontracts.projectId, parsed.projectId),
        eq(schema.subcontracts.tenantId, tenant.id),
        eq(schema.subcontracts.status, 'active'),
      ),
    );

  if (subs.length === 0) {
    throw new Error(
      'No active subcontracts on this project — add at least one (status=active) before starting a pay-app cycle.',
    );
  }

  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000,
  );

  // For each sub: create pay_app + magic_link in a single transaction.
  // Subs without a contact_email are skipped (the magic-link recipient
  // is required); we collect them for the redirect summary.
  const created: Array<{ name: string; token: string }> = [];
  const skipped: string[] = [];

  for (const sub of subs) {
    if (!sub.subcontractorEmail) {
      skipped.push(sub.subcontractorName);
      continue;
    }

    const rawToken = generateRawToken();
    const tokenHash = hashToken(rawToken);

    await db.transaction(async (tx) => {
      const [payApp] = await tx
        .insert(schema.payApplications)
        .values({
          tenantId: tenant.id,
          projectId: parsed.projectId,
          direction: 'sub_to_gc',
          subcontractId: sub.subcontractId,
          periodStart: parsed.periodStart,
          periodEnd: parsed.periodEnd,
          status: 'draft',
        })
        .returning({ id: schema.payApplications.id });
      if (!payApp) throw new Error('Pay-app insert returned no row');

      await tx.insert(schema.magicLinks).values({
        tenantId: tenant.id,
        targetEntityType: 'pay_application',
        targetEntityId: payApp.id,
        recipientEmail: sub.subcontractorEmail!,
        recipientRole: 'sub_user',
        tokenHash,
        action: 'approve_or_reject',
        expiresAt,
      });
    });

    created.push({ name: sub.subcontractorName, token: rawToken });
  }

  // Carry the just-generated raw tokens into the redirect so the page can
  // render copy-able URLs. We don't store raw tokens (only their hashes),
  // so this is the only moment they're recoverable.
  const params = new URLSearchParams();
  params.set('startedPeriod', parsed.periodStart);
  params.set(
    'tokens',
    created.map((c) => `${encodeURIComponent(c.name)}|${c.token}`).join(','),
  );
  if (skipped.length > 0) {
    params.set('skipped', skipped.join(','));
  }

  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  redirect(`/projects/${parsed.projectId}/pay-apps?${params.toString()}`);
}

// PM approves a submitted sub pay-app. Reducer guards the transition,
// then we update status + insert audit row in one tx.

const ApproveSubPayAppInput = z.object({
  payAppId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export async function approveSubPayApp(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = ApproveSubPayAppInput.parse({
    payAppId: formData.get('payAppId'),
    projectId: formData.get('projectId'),
  });

  // Read pay app inside tenant + project scope; require project active.
  const [payApp] = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
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
        eq(schema.payApplications.id, parsed.payAppId),
        eq(schema.payApplications.projectId, parsed.projectId),
        eq(schema.payApplications.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!payApp) throw new Error('Pay app not found or project archived');
  if (payApp.direction !== 'sub_to_gc') {
    throw new Error('approveSubPayApp only handles sub_to_gc pay apps');
  }

  const transition = pmApproveSubPayApp(
    payApp.status as Parameters<typeof pmApproveSubPayApp>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.payApplications)
      .set({
        status: 'approved',
        approvedAt: new Date(),
      })
      .where(eq(schema.payApplications.id, payApp.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'pay_application',
      entityId: payApp.id,
      fromStatus: 'submitted',
      toStatus: 'approved',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'Approved by PM',
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  revalidatePath(`/projects/${parsed.projectId}/pay-apps/${payApp.id}`);
  redirect(`/projects/${parsed.projectId}/pay-apps`);
}

// PM requests revision on a submitted sub pay-app. Comment required.
// Re-issues a fresh magic-link so the sub can edit + re-submit; the
// raw token rides the redirect so the GC can copy it (until Resend).

const RequestRevisionInput = z.object({
  payAppId: z.string().uuid(),
  projectId: z.string().uuid(),
  comment: z.string().trim().min(1, 'comment is required').max(2000),
});

export async function requestRevisionSubPayApp(
  formData: FormData,
): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = RequestRevisionInput.parse({
    payAppId: formData.get('payAppId'),
    projectId: formData.get('projectId'),
    comment: formData.get('comment'),
  });

  const [payApp] = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
      subcontractId: schema.payApplications.subcontractId,
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
        eq(schema.payApplications.id, parsed.payAppId),
        eq(schema.payApplications.projectId, parsed.projectId),
        eq(schema.payApplications.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!payApp || !payApp.subcontractId) {
    throw new Error('Pay app not found or project archived');
  }

  const transition = pmRequestRevisionSubPayApp(
    payApp.status as Parameters<typeof pmRequestRevisionSubPayApp>[0],
    parsed.comment,
  );
  if (!transition.ok) throw new Error(transition.error);

  // Look up the sub's email for the new magic-link.
  const [subEmail] = await db
    .select({ email: schema.subcontractors.contactEmail })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .where(eq(schema.subcontracts.id, payApp.subcontractId))
    .limit(1);
  if (!subEmail || !subEmail.email) {
    throw new Error('Subcontractor has no contact email — add one first');
  }
  const recipientEmail = subEmail.email;

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(schema.payApplications)
      .set({ status: 'needs_revision' })
      .where(eq(schema.payApplications.id, payApp.id));

    await tx.insert(schema.magicLinks).values({
      tenantId: tenant.id,
      targetEntityType: 'pay_application',
      targetEntityId: payApp.id,
      recipientEmail,
      recipientRole: 'sub_user',
      tokenHash,
      action: 'approve_or_reject',
      expiresAt,
    });

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'pay_application',
      entityId: payApp.id,
      fromStatus: 'submitted',
      toStatus: 'needs_revision',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: parsed.comment,
    });
  });

  // Carry the new raw token back to the list view so it can be re-shared.
  const params = new URLSearchParams({
    revisionPayApp: payApp.id,
    revisionToken: rawToken,
  });
  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  redirect(`/projects/${parsed.projectId}/pay-apps?${params.toString()}`);
}
