'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  cancelSubPayApp,
  checkSubBillableCeiling,
  markOwnerPayAppPaid,
  pmApproveSubPayApp,
  pmRequestRevisionSubPayApp,
  rollIntoOwnerPayApp,
  sendOwnerPayAppToOwner,
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
import { centsToDollarsString, dollarsStringToCents } from '@/lib/money';
import { notifyMagicLink } from '@/lib/email';

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
    .select({ id: schema.projects.id, name: schema.projects.name })
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

    // Best-effort email — failures log only; the in-app banner is the
    // dev/no-RESEND fallback so the GC can deliver out-of-band.
    void notifyMagicLink({
      to: sub.subcontractorEmail,
      recipientLabel: sub.subcontractorName,
      documentLabel: 'pay application',
      projectName: project.name,
      contractorName: tenant.name,
      approvalUrl: `${resolveBaseUrl().replace(/\/+$/, '')}/sub-pay-app/${rawToken}`,
      expiresInHours: MAGIC_LINK_TTL_HOURS,
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

// PM approves a submitted sub pay-app, persisting per-line GC adjusted %
// overrides. The review table sends `adjusted[<lineId>]` (percent) and
// optional `note[<lineId>]` (text) form fields. We recompute thisPeriod $
// and retention from the GC %, run the sub-billable ceiling against the
// approved totals, then UPDATE every pay_application_lines row, the
// pay_applications row totals, and insert an audit event in one tx.

const ApproveSubPayAppInput = z.object({
  payAppId: z.string().uuid(),
  projectId: z.string().uuid(),
});

const RETENTION_PCT = 10;

type LineEdit = { lineId: string; adjustedPercent: number; note: string };

function parseLineEdits(formData: FormData): LineEdit[] {
  const out: Record<string, LineEdit> = {};
  for (const [key, value] of formData.entries()) {
    const adjMatch = /^adjusted\[([^\]]+)\]$/.exec(key);
    if (adjMatch) {
      const id = adjMatch[1]!;
      const num = Number(value);
      const pct = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
      out[id] = {
        ...(out[id] ?? { lineId: id, adjustedPercent: 0, note: '' }),
        lineId: id,
        adjustedPercent: pct,
      };
      continue;
    }
    const noteMatch = /^note\[([^\]]+)\]$/.exec(key);
    if (noteMatch) {
      const id = noteMatch[1]!;
      out[id] = {
        ...(out[id] ?? { lineId: id, adjustedPercent: 0, note: '' }),
        lineId: id,
        note: String(value).trim().slice(0, 2000),
      };
      continue;
    }
  }
  return Object.values(out);
}

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
  if (!payApp) throw new Error('Pay app not found or project archived');
  if (payApp.direction !== 'sub_to_gc') {
    throw new Error('approveSubPayApp only handles sub_to_gc pay apps');
  }
  if (!payApp.subcontractId) {
    throw new Error('Sub pay-app missing subcontract reference');
  }

  const transition = pmApproveSubPayApp(
    payApp.status as Parameters<typeof pmApproveSubPayApp>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  // Pull existing pay-app lines with their SoV current_amount + the
  // previously-billed snapshot we captured at submission time. We do NOT
  // re-query previously-billed here — the sub's snapshot is the basis we
  // approve against, so the approved total stays internally consistent.
  const existingLines = await db
    .select({
      id: schema.payApplicationLines.id,
      sovLineId: schema.payApplicationLines.sovLineId,
      previouslyBilledAmount: schema.payApplicationLines.previouslyBilledAmount,
      subReportedPercent: schema.payApplicationLines.subReportedPercent,
      gcAdjustedPercent: schema.payApplicationLines.gcAdjustedPercent,
      sovCurrentAmount: schema.sovLines.currentAmount,
    })
    .from(schema.payApplicationLines)
    .innerJoin(
      schema.sovLines,
      eq(schema.payApplicationLines.sovLineId, schema.sovLines.id),
    )
    .where(eq(schema.payApplicationLines.payApplicationId, payApp.id));
  if (existingLines.length === 0) {
    throw new Error('Pay app has no line items to approve');
  }

  const editsByLineId = new Map(
    parseLineEdits(formData).map((e) => [e.lineId, e]),
  );

  // Subcontract for the aggregate ceiling check.
  const [sub] = await db
    .select({ currentAmount: schema.subcontracts.currentAmount })
    .from(schema.subcontracts)
    .where(eq(schema.subcontracts.id, payApp.subcontractId))
    .limit(1);
  if (!sub) throw new Error('Subcontract not found');
  const subContractCents = dollarsStringToCents(sub.currentAmount);

  type LineUpdate = {
    id: string;
    sovLineId: string;
    gcAdjustedPercent: string;
    thisPeriodAmount: string;
    retentionAmount: string;
    gcNote: string | null;
    previouslyBilledCents: number;
    sovCurrentCents: number;
    thisPeriodCents: number;
  };

  const updates: LineUpdate[] = [];
  let totalThisPeriodCents = 0;
  let totalRetentionCents = 0;
  let aggregatePreviouslyBilledCents = 0;

  for (const line of existingLines) {
    // Default to the sub's reported percent if the GC didn't touch this row.
    const edit = editsByLineId.get(line.id);
    const adjustedPercent = edit?.adjustedPercent ?? Number(line.gcAdjustedPercent);
    const note = edit?.note ?? null;

    const sovCurrentCents = dollarsStringToCents(line.sovCurrentAmount);
    const previouslyBilledCents = dollarsStringToCents(line.previouslyBilledAmount);
    const earnedToDateCents = Math.round((sovCurrentCents * adjustedPercent) / 100);
    const thisPeriodCents = Math.max(0, earnedToDateCents - previouslyBilledCents);
    const retentionCents = Math.round((thisPeriodCents * RETENTION_PCT) / 100);

    // Per-line ceiling check — GC can't approve more than the SoV line.
    const lineCheck = checkSubBillableCeiling({
      subcontractCurrentAmountCents: sovCurrentCents,
      previouslyBilledAmountCents: previouslyBilledCents,
      thisPeriodAmountCents: thisPeriodCents,
    });
    if (!lineCheck.ok) {
      throw new Error(
        `Approved % on line ${line.sovLineId} exceeds the SoV scheduled value by $${(lineCheck.overageCents / 100).toFixed(2)} — lower the percentage or open a CO.`,
      );
    }

    totalThisPeriodCents += thisPeriodCents;
    totalRetentionCents += retentionCents;
    aggregatePreviouslyBilledCents += previouslyBilledCents;

    updates.push({
      id: line.id,
      sovLineId: line.sovLineId,
      gcAdjustedPercent: adjustedPercent.toFixed(2),
      thisPeriodAmount: centsToDollarsString(thisPeriodCents),
      retentionAmount: centsToDollarsString(retentionCents),
      gcNote: note && note.length > 0 ? note : null,
      previouslyBilledCents,
      sovCurrentCents,
      thisPeriodCents,
    });
  }

  // Aggregate ceiling against the whole subcontract.
  const aggregateCheck = checkSubBillableCeiling({
    subcontractCurrentAmountCents: subContractCents,
    previouslyBilledAmountCents: aggregatePreviouslyBilledCents,
    thisPeriodAmountCents: totalThisPeriodCents,
  });
  if (!aggregateCheck.ok) {
    throw new Error(
      `Approved totals exceed the subcontract ceiling by $${(aggregateCheck.overageCents / 100).toFixed(2)} — lower an approved percentage or open a CO first.`,
    );
  }

  await db.transaction(async (tx) => {
    for (const u of updates) {
      await tx
        .update(schema.payApplicationLines)
        .set({
          gcAdjustedPercent: u.gcAdjustedPercent,
          thisPeriodAmount: u.thisPeriodAmount,
          retentionAmount: u.retentionAmount,
          gcNote: u.gcNote,
        })
        .where(eq(schema.payApplicationLines.id, u.id));
    }

    await tx
      .update(schema.payApplications)
      .set({
        status: 'approved',
        approvedAt: new Date(),
        totalBilled: centsToDollarsString(totalThisPeriodCents),
        totalRetention: centsToDollarsString(totalRetentionCents),
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

  // Look up the sub's email + project name for the new magic-link.
  const [subEmail] = await db
    .select({
      email: schema.subcontractors.contactEmail,
      subName: schema.subcontractors.name,
      projectName: schema.projects.name,
    })
    .from(schema.subcontracts)
    .innerJoin(
      schema.subcontractors,
      eq(schema.subcontracts.subcontractorId, schema.subcontractors.id),
    )
    .innerJoin(
      schema.projects,
      eq(schema.subcontracts.projectId, schema.projects.id),
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

  void notifyMagicLink({
    to: recipientEmail,
    recipientLabel: subEmail.subName,
    documentLabel: 'pay application (revision requested)',
    projectName: subEmail.projectName,
    contractorName: tenant.name,
    approvalUrl: `${resolveBaseUrl().replace(/\/+$/, '')}/sub-pay-app/${rawToken}`,
    expiresInHours: MAGIC_LINK_TTL_HOURS,
  });

  // Carry the new raw token back to the list view so it can be re-shared.
  const params = new URLSearchParams({
    revisionPayApp: payApp.id,
    revisionToken: rawToken,
  });
  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  redirect(`/projects/${parsed.projectId}/pay-apps?${params.toString()}`);
}

// assembleOwnerPayApp: aggregate every approved sub_to_gc pay-app for the
// given period into a fresh gc_to_owner pay_application. Each source line
// becomes one owner pay-app line (1:1, preserving traceability via
// sov_line_id). Rolled-up sub pay-apps transition to
// included_in_owner_pay_app. All in one transaction.
//
// MVP scope: rolls only approved sub work. GC-internal billing
// (subcontract_id IS NULL SoV lines billed by the GC for bonding,
// permits, OH&P) is a follow-up — those lines aren't rolled in here yet.

const AssembleOwnerPayAppInput = z.object({
  projectId: z.string().uuid(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD'),
});

export async function assembleOwnerPayApp(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = AssembleOwnerPayAppInput.parse({
    projectId: formData.get('projectId'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
  });

  if (parsed.periodStart > parsed.periodEnd) {
    throw new Error('Period start must be on or before period end');
  }

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

  // Refuse if a gc_to_owner pay app already exists for this period.
  const existing = await db
    .select({ id: schema.payApplications.id })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.projectId, parsed.projectId),
        eq(schema.payApplications.tenantId, tenant.id),
        eq(schema.payApplications.direction, 'gc_to_owner'),
        eq(schema.payApplications.periodStart, parsed.periodStart),
        eq(schema.payApplications.periodEnd, parsed.periodEnd),
      ),
    )
    .limit(1);
  if (existing.length > 0) {
    throw new Error(
      'An owner pay app already exists for this period. Cancel/delete it first or pick a different period.',
    );
  }

  const approvedSubPayApps = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
    })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.projectId, parsed.projectId),
        eq(schema.payApplications.tenantId, tenant.id),
        eq(schema.payApplications.direction, 'sub_to_gc'),
        eq(schema.payApplications.periodStart, parsed.periodStart),
        eq(schema.payApplications.periodEnd, parsed.periodEnd),
        eq(schema.payApplications.status, 'approved'),
      ),
    );

  if (approvedSubPayApps.length === 0) {
    throw new Error(
      'No approved sub pay apps for this period. Approve at least one sub submission before assembling.',
    );
  }

  const subPayAppIds = approvedSubPayApps.map((p) => p.id);
  const subLines = await db
    .select({
      sourcePayAppId: schema.payApplicationLines.payApplicationId,
      sovLineId: schema.payApplicationLines.sovLineId,
      previouslyBilledAmount: schema.payApplicationLines.previouslyBilledAmount,
      gcAdjustedPercent: schema.payApplicationLines.gcAdjustedPercent,
      thisPeriodAmount: schema.payApplicationLines.thisPeriodAmount,
      storedMaterialsAmount: schema.payApplicationLines.storedMaterialsAmount,
      retentionAmount: schema.payApplicationLines.retentionAmount,
    })
    .from(schema.payApplicationLines)
    .where(inArray(schema.payApplicationLines.payApplicationId, subPayAppIds));

  let totalBilledCents = 0;
  let totalRetentionCents = 0;
  for (const l of subLines) {
    totalBilledCents += dollarsStringToCents(l.thisPeriodAmount);
    totalRetentionCents += dollarsStringToCents(l.retentionAmount);
  }

  // Reducer guard for each source pay app.
  for (const p of approvedSubPayApps) {
    const t = rollIntoOwnerPayApp(
      p.status as Parameters<typeof rollIntoOwnerPayApp>[0],
      'pending-id',
    );
    if (!t.ok) throw new Error(t.error);
  }

  await db.transaction(async (tx) => {
    const [ownerPayApp] = await tx
      .insert(schema.payApplications)
      .values({
        tenantId: tenant.id,
        projectId: parsed.projectId,
        direction: 'gc_to_owner',
        periodStart: parsed.periodStart,
        periodEnd: parsed.periodEnd,
        status: 'generated',
        totalBilled: centsToDollarsString(totalBilledCents),
        totalRetention: centsToDollarsString(totalRetentionCents),
      })
      .returning({ id: schema.payApplications.id });
    if (!ownerPayApp) throw new Error('Owner pay-app insert returned no row');

    if (subLines.length > 0) {
      await tx.insert(schema.payApplicationLines).values(
        subLines.map((l) => ({
          payApplicationId: ownerPayApp.id,
          sovLineId: l.sovLineId,
          previouslyBilledAmount: l.previouslyBilledAmount,
          subReportedPercent: l.gcAdjustedPercent,
          gcAdjustedPercent: l.gcAdjustedPercent,
          thisPeriodAmount: l.thisPeriodAmount,
          storedMaterialsAmount: l.storedMaterialsAmount,
          retentionAmount: l.retentionAmount,
        })),
      );
    }

    for (const sp of approvedSubPayApps) {
      await tx
        .update(schema.payApplications)
        .set({ status: 'included_in_owner_pay_app' })
        .where(eq(schema.payApplications.id, sp.id));

      await tx.insert(schema.approvalEvents).values({
        tenantId: tenant.id,
        entityType: 'pay_application',
        entityId: sp.id,
        fromStatus: 'approved',
        toStatus: 'included_in_owner_pay_app',
        actorType: 'system',
        actorUserId: user.id,
        comment: `Rolled into owner pay app ${ownerPayApp.id}`,
      });
    }

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'pay_application',
      entityId: ownerPayApp.id,
      fromStatus: null,
      toStatus: 'generated',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: `Assembled from ${approvedSubPayApps.length} approved sub pay app(s)`,
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  redirect(`/projects/${parsed.projectId}/pay-apps`);
}

// GC sends a generated owner pay-app to the project owner via magic-link.
// Owner clicks the link and approves/rejects on /approve/[token]. Owner
// email resolved from project.ownerId → organizations.contact_email.

const OWNER_PAY_APP_LINK_TTL_HOURS = 168; // one week — owner sign-off can take time

const SendOwnerPayAppInput = z.object({
  payAppId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export async function sendOwnerPayAppToOwnerAction(
  formData: FormData,
): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = SendOwnerPayAppInput.parse({
    payAppId: formData.get('payAppId'),
    projectId: formData.get('projectId'),
  });

  const [row] = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
      direction: schema.payApplications.direction,
      projectOwnerId: schema.projects.ownerId,
      projectName: schema.projects.name,
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
  if (!row) throw new Error('Owner pay-app not found or project archived');
  if (row.direction !== 'gc_to_owner') {
    throw new Error('sendOwnerPayAppToOwner only handles gc_to_owner pay apps');
  }
  if (!row.projectOwnerId) {
    throw new Error(
      'Project has no owner organization attached — set one before sending.',
    );
  }

  const [owner] = await db
    .select({ email: schema.organizations.contactEmail })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, row.projectOwnerId))
    .limit(1);
  if (!owner || !owner.email) {
    throw new Error('Owner organization has no contact email — add one first.');
  }
  const ownerEmail = owner.email;

  const transition = sendOwnerPayAppToOwner(
    row.status as Parameters<typeof sendOwnerPayAppToOwner>[0],
    'pending-insert',
  );
  if (!transition.ok) throw new Error(transition.error);

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + OWNER_PAY_APP_LINK_TTL_HOURS * 60 * 60 * 1000,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(schema.payApplications)
      .set({ status: 'sent_to_owner' })
      .where(eq(schema.payApplications.id, row.id));

    await tx.insert(schema.magicLinks).values({
      tenantId: tenant.id,
      targetEntityType: 'pay_application',
      targetEntityId: row.id,
      recipientEmail: ownerEmail,
      recipientRole: 'owner',
      tokenHash,
      action: 'approve_or_reject',
      expiresAt,
    });

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'pay_application',
      entityId: row.id,
      fromStatus: 'generated',
      toStatus: 'sent_to_owner',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: `Sent to owner ${ownerEmail}`,
    });
  });

  void notifyMagicLink({
    to: ownerEmail,
    recipientLabel: 'Project Owner',
    documentLabel: 'pay application',
    projectName: row.projectName,
    contractorName: tenant.name,
    approvalUrl: buildApproveUrl(rawToken, resolveBaseUrl()),
    expiresInHours: OWNER_PAY_APP_LINK_TTL_HOURS,
  });

  // Carry the raw token in the redirect so the GC can copy the URL until
  // Resend delivery is wired everywhere.
  const params = new URLSearchParams({
    ownerLinkPayApp: row.id,
    ownerLinkToken: rawToken,
  });
  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  redirect(`/projects/${parsed.projectId}/pay-apps?${params.toString()}`);
}

const MarkPaidInput = z.object({
  payAppId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export async function markOwnerPayAppPaidAction(
  formData: FormData,
): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = MarkPaidInput.parse({
    payAppId: formData.get('payAppId'),
    projectId: formData.get('projectId'),
  });

  const [row] = await db
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
  if (!row) throw new Error('Owner pay-app not found or project archived');
  if (row.direction !== 'gc_to_owner') {
    throw new Error('markOwnerPayAppPaid only handles gc_to_owner pay apps');
  }

  const transition = markOwnerPayAppPaid(
    row.status as Parameters<typeof markOwnerPayAppPaid>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.payApplications)
      .set({ status: 'paid' })
      .where(eq(schema.payApplications.id, row.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'pay_application',
      entityId: row.id,
      fromStatus: 'owner_approved',
      toStatus: 'paid',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'Marked paid by GC',
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  redirect(`/projects/${parsed.projectId}/pay-apps`);
}

// Cancel/void a sub pay-app. Legal pre-rollup. Consumes any outstanding
// magic-link tied to the pay app so it can't be used to submit after cancel.

const CancelSubPayAppInput = z.object({
  payAppId: z.string().uuid(),
  projectId: z.string().uuid(),
  reason: z.string().trim().min(1, 'reason required').max(2000),
});

export async function cancelSubPayAppAction(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = CancelSubPayAppInput.parse({
    payAppId: formData.get('payAppId'),
    projectId: formData.get('projectId'),
    reason: formData.get('reason'),
  });

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
    throw new Error('cancelSubPayApp only handles sub_to_gc pay apps');
  }

  const transition = cancelSubPayApp(
    payApp.status as Parameters<typeof cancelSubPayApp>[0],
    parsed.reason,
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.payApplications)
      .set({ status: 'cancelled' })
      .where(eq(schema.payApplications.id, payApp.id));

    await tx
      .update(schema.magicLinks)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(schema.magicLinks.targetEntityType, 'pay_application'),
          eq(schema.magicLinks.targetEntityId, payApp.id),
          isNull(schema.magicLinks.consumedAt),
        ),
      );

    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'pay_application',
      entityId: payApp.id,
      fromStatus: payApp.status,
      toStatus: 'cancelled',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: parsed.reason,
    });
  });

  revalidatePath(`/projects/${parsed.projectId}/pay-apps`);
  redirect(`/projects/${parsed.projectId}/pay-apps`);
}
