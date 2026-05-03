'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import {
  checkSubBillableCeiling,
  submitSubPayApp,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { TOKEN_PATTERN, loadValidLink } from '@/lib/magic-link';
import { centsToDollarsString, dollarsStringToCents } from '@/lib/money';
import { previouslyBilledByLineForSubcontract } from '@/lib/pay-app-rollup';
import { leafSovLinesForSubcontract } from '@/lib/sov-leaves';

// Sub portal: real submit. The sub fills percentages on each line of their
// SoV; we run the ceiling invariant on every line, persist
// pay_application_lines, transition the pay_application to 'submitted',
// mark the magic-link consumed, and insert an approval_event audit row.
//
// Save-Draft (intermediate) is intentionally not wired in 2a — adds noise
// without changing the wedge. Lands when needed.

const SubmitInput = z.object({
  token: z.string().regex(TOKEN_PATTERN, 'invalid token'),
  // line[<sovLineId>][percent] / line[<sovLineId>][stored]
  // are the form-encoded line values; we collect them by SoV line id.
});

type LineInput = {
  sovLineId: string;
  percent: number; // 0–100
  storedMaterials: number; // dollars (from input)
};

function parseLineInputs(formData: FormData): LineInput[] {
  // Expected field naming: percent[<id>] and stored[<id>].
  const out: Record<string, LineInput> = {};
  for (const [key, value] of formData.entries()) {
    const pctMatch = /^percent\[([^\]]+)\]$/.exec(key);
    if (pctMatch) {
      const id = pctMatch[1]!;
      const num = Number(value);
      const pct = Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
      out[id] = { ...(out[id] ?? { sovLineId: id, percent: 0, storedMaterials: 0 }), sovLineId: id, percent: pct };
      continue;
    }
    const storedMatch = /^stored\[([^\]]+)\]$/.exec(key);
    if (storedMatch) {
      const id = storedMatch[1]!;
      const num = Number(value);
      const stored = Number.isFinite(num) ? Math.max(0, num) : 0;
      out[id] = { ...(out[id] ?? { sovLineId: id, percent: 0, storedMaterials: 0 }), sovLineId: id, storedMaterials: stored };
      continue;
    }
  }
  return Object.values(out);
}

export async function submitSubPayAppAction(formData: FormData): Promise<void> {
  const parsed = SubmitInput.parse({
    token: formData.get('token'),
  });
  const link = await loadValidLink(parsed.token);

  if (
    link.targetEntityType !== 'pay_application' ||
    link.recipientRole !== 'sub_user'
  ) {
    throw new Error(
      `magic-link target ${link.targetEntityType} / role ${link.recipientRole} not supported on sub portal`,
    );
  }

  // Resolve the pay app + the subcontract (for ceiling check).
  const [payApp] = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
      projectId: schema.payApplications.projectId,
      subcontractId: schema.payApplications.subcontractId,
    })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.id, link.targetEntityId),
        eq(schema.payApplications.tenantId, link.tenantId),
      ),
    )
    .limit(1);
  if (!payApp || !payApp.subcontractId) throw new Error('Pay app not found');

  const [sub] = await db
    .select({
      currentAmount: schema.subcontracts.currentAmount,
    })
    .from(schema.subcontracts)
    .where(eq(schema.subcontracts.id, payApp.subcontractId))
    .limit(1);
  if (!sub) throw new Error('Subcontract not found');

  // State machine guard. The DB pay_app_status enum is the union of
  // SubPayApp + OwnerPayApp kinds; we know this row is sub_to_gc (we
  // verified via the magic-link target/role above), so the status is
  // safely within the SubPayApp subset. Cast narrows the wider DB type
  // to what the reducer accepts.
  const transition = submitSubPayApp(
    payApp.status as Parameters<typeof submitSubPayApp>[0],
  );
  if (!transition.ok) throw new Error(transition.error);

  // Leaf SoV lines for this sub — same filter the portal uses to render
  // the form. Parents broken into children are excluded.
  const sovLines = await leafSovLinesForSubcontract({
    subcontractId: payApp.subcontractId,
    tenantId: link.tenantId,
    projectId: payApp.projectId,
  });

  // Real previously-billed lookup, scoped to finalized prior pay apps on
  // this subcontract (excluding the one we're submitting).
  const previouslyBilledByLine = await previouslyBilledByLineForSubcontract({
    subcontractId: payApp.subcontractId,
    tenantId: link.tenantId,
    excludePayAppId: payApp.id,
  });

  const linesById = new Map(sovLines.map((l) => [l.id, l]));
  const inputs = parseLineInputs(formData);

  // Aggregate previously-billed across the whole subcontract for the
  // subcontract-level ceiling guard.
  let aggregatePreviouslyBilledCents = 0;
  for (const dollars of previouslyBilledByLine.values()) {
    aggregatePreviouslyBilledCents += Math.round(dollars * 100);
  }

  // For each input line: compute this-period dollars, run ceiling, build
  // the row to insert.
  const RETENTION_PCT_CENTS = 10; // 10% retention
  const subContractCents = dollarsStringToCents(sub.currentAmount);

  let totalThisPeriodCents = 0;
  let totalRetentionCents = 0;
  const linesToInsert: Array<{
    payApplicationId: string;
    sovLineId: string;
    previouslyBilledAmount: string;
    subReportedPercent: string;
    gcAdjustedPercent: string;
    thisPeriodAmount: string;
    storedMaterialsAmount: string;
    retentionAmount: string;
  }> = [];

  for (const input of inputs) {
    const sov = linesById.get(input.sovLineId);
    if (!sov) {
      throw new Error(`SoV line ${input.sovLineId} not found on this subcontract`);
    }

    const sovCurrentCents = dollarsStringToCents(sov.currentAmount);
    // Earned-to-date based on percent.
    const earnedToDateCents = Math.round(
      (sovCurrentCents * input.percent) / 100,
    );
    const previouslyBilledCents = Math.round(
      (previouslyBilledByLine.get(input.sovLineId) ?? 0) * 100,
    );
    const thisPeriodCents = Math.max(0, earnedToDateCents - previouslyBilledCents);
    const storedCents = Math.round(input.storedMaterials * 100);
    const retentionCents = Math.round(
      (thisPeriodCents * RETENTION_PCT_CENTS) / 100,
    );

    // Per-line ceiling check (also enforced at subcontract aggregate below).
    // Each line's own previously+this must not exceed its own current_amount.
    const lineCheck = checkSubBillableCeiling({
      subcontractCurrentAmountCents: sovCurrentCents,
      previouslyBilledAmountCents: previouslyBilledCents,
      thisPeriodAmountCents: thisPeriodCents,
    });
    if (!lineCheck.ok) {
      throw new Error(
        `Line ${sov.id} exceeds its scheduled value by $${(lineCheck.overageCents / 100).toFixed(2)} — submit a CO with the GC if additional work is approved.`,
      );
    }

    totalThisPeriodCents += thisPeriodCents;
    totalRetentionCents += retentionCents;

    linesToInsert.push({
      payApplicationId: payApp.id,
      sovLineId: input.sovLineId,
      previouslyBilledAmount: centsToDollarsString(previouslyBilledCents),
      subReportedPercent: input.percent.toFixed(2),
      gcAdjustedPercent: input.percent.toFixed(2), // PM may override on review
      thisPeriodAmount: centsToDollarsString(thisPeriodCents),
      storedMaterialsAmount: centsToDollarsString(storedCents),
      retentionAmount: centsToDollarsString(retentionCents),
    });
  }

  // Subcontract-aggregate ceiling check: total billed across all lines
  // (including prior periods) shouldn't exceed the subcontract's current
  // amount.
  const aggregateCheck = checkSubBillableCeiling({
    subcontractCurrentAmountCents: subContractCents,
    previouslyBilledAmountCents: aggregatePreviouslyBilledCents,
    thisPeriodAmountCents: totalThisPeriodCents,
  });
  if (!aggregateCheck.ok) {
    throw new Error(
      `Total this period exceeds your contract ceiling by $${(aggregateCheck.overageCents / 100).toFixed(2)} — submit a CO with the GC if additional work is approved.`,
    );
  }

  // Single transaction: insert lines, update pay app, mark link consumed,
  // insert audit row. All-or-nothing.
  await db.transaction(async (tx) => {
    if (linesToInsert.length > 0) {
      await tx.insert(schema.payApplicationLines).values(linesToInsert);
    }

    await tx
      .update(schema.payApplications)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        totalBilled: centsToDollarsString(totalThisPeriodCents),
        totalRetention: centsToDollarsString(totalRetentionCents),
      })
      .where(eq(schema.payApplications.id, payApp.id));

    await tx
      .update(schema.magicLinks)
      .set({ consumedAt: new Date() })
      .where(eq(schema.magicLinks.id, link.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: link.tenantId,
      entityType: 'pay_application',
      entityId: payApp.id,
      fromStatus: 'draft',
      toStatus: 'submitted',
      actorType: 'external_invitee',
      actorExternalEmail: link.recipientEmail,
      comment: 'Submitted via sub portal magic-link',
    });
  });

  revalidatePath(`/projects/${payApp.projectId}/pay-apps`);

  redirect(`/sub-pay-app/${parsed.token}?status=submitted`);
}

// Save Draft — persists current line values without transitioning the pay
// app or consuming the magic-link. Sub can come back via the same URL,
// see their saved values, and continue. Replaces all existing
// pay_application_lines for this pay app to keep the row set in sync with
// the latest form state (simpler than upsert-by-sov-line).

export async function saveDraftSubPayAppAction(formData: FormData): Promise<void> {
  const parsed = SubmitInput.parse({
    token: formData.get('token'),
  });
  const link = await loadValidLink(parsed.token);

  if (
    link.targetEntityType !== 'pay_application' ||
    link.recipientRole !== 'sub_user'
  ) {
    throw new Error(
      `magic-link target ${link.targetEntityType} / role ${link.recipientRole} not supported on sub portal`,
    );
  }

  const [payApp] = await db
    .select({
      id: schema.payApplications.id,
      status: schema.payApplications.status,
      projectId: schema.payApplications.projectId,
      subcontractId: schema.payApplications.subcontractId,
    })
    .from(schema.payApplications)
    .where(
      and(
        eq(schema.payApplications.id, link.targetEntityId),
        eq(schema.payApplications.tenantId, link.tenantId),
      ),
    )
    .limit(1);
  if (!payApp || !payApp.subcontractId) throw new Error('Pay app not found');

  // Save Draft is only legal while the sub still has the editing right —
  // i.e. status is draft (initial) or needs_revision (GC bounced it back).
  if (payApp.status !== 'draft' && payApp.status !== 'needs_revision') {
    throw new Error(
      `cannot save draft from state '${payApp.status}' — pay app is no longer editable`,
    );
  }

  const sovLines = await leafSovLinesForSubcontract({
    subcontractId: payApp.subcontractId,
    tenantId: link.tenantId,
    projectId: payApp.projectId,
  });
  const previouslyBilledByLine = await previouslyBilledByLineForSubcontract({
    subcontractId: payApp.subcontractId,
    tenantId: link.tenantId,
    excludePayAppId: payApp.id,
  });

  const linesById = new Map(sovLines.map((l) => [l.id, l]));
  const inputs = parseLineInputs(formData);

  const RETENTION_PCT_CENTS = 10;
  const linesToInsert: Array<{
    payApplicationId: string;
    sovLineId: string;
    previouslyBilledAmount: string;
    subReportedPercent: string;
    gcAdjustedPercent: string;
    thisPeriodAmount: string;
    storedMaterialsAmount: string;
    retentionAmount: string;
  }> = [];

  for (const input of inputs) {
    const sov = linesById.get(input.sovLineId);
    if (!sov) {
      throw new Error(`SoV line ${input.sovLineId} not found on this subcontract`);
    }
    const sovCurrentCents = dollarsStringToCents(sov.currentAmount);
    const earnedToDateCents = Math.round((sovCurrentCents * input.percent) / 100);
    const previouslyBilledCents = Math.round(
      (previouslyBilledByLine.get(input.sovLineId) ?? 0) * 100,
    );
    const thisPeriodCents = Math.max(0, earnedToDateCents - previouslyBilledCents);
    const storedCents = Math.round(input.storedMaterials * 100);
    const retentionCents = Math.round((thisPeriodCents * RETENTION_PCT_CENTS) / 100);

    linesToInsert.push({
      payApplicationId: payApp.id,
      sovLineId: input.sovLineId,
      previouslyBilledAmount: centsToDollarsString(previouslyBilledCents),
      subReportedPercent: input.percent.toFixed(2),
      gcAdjustedPercent: input.percent.toFixed(2),
      thisPeriodAmount: centsToDollarsString(thisPeriodCents),
      storedMaterialsAmount: centsToDollarsString(storedCents),
      retentionAmount: centsToDollarsString(retentionCents),
    });
  }

  // No ceiling check on save-draft — overruns are allowed mid-edit, just
  // not at submit time. The form already highlights over-ceiling lines.
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.payApplicationLines)
      .where(eq(schema.payApplicationLines.payApplicationId, payApp.id));
    if (linesToInsert.length > 0) {
      await tx.insert(schema.payApplicationLines).values(linesToInsert);
    }
  });

  redirect(`/sub-pay-app/${parsed.token}?status=draft-saved`);
}
