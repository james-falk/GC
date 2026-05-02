'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  approveChangeOrderDirect,
  sendDraftToOwner,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ensureCurrentUser } from '@/lib/user';
import { generateRawToken, hashToken } from '@/lib/magic-link';

// Server actions for the ChangeOrder workflow.
//
// saveCoDraft persists a new CO + its lines as 'draft'. Approve / atomic
// propagation lands in the next commit alongside this file's
// approveChangeOrder action.

const SaveCoDraftInput = z.object({
  projectId: z.string().uuid(),
  coNumber: z.string().trim().min(1, 'required').max(64),
  description: z.string().trim().min(1, 'required').max(1000),
  justification: z
    .string()
    .trim()
    .max(5000)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  affectedSubcontractId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  lines: z
    .array(
      z.object({
        sovLineId: z.string().uuid(),
        deltaAmount: z
          .string()
          .trim()
          .regex(
            /^-?\d+(\.\d{1,2})?$/,
            'must be a signed amount with up to 2 decimal places',
          ),
        reason: z
          .string()
          .max(500)
          .optional()
          .or(z.literal('').transform(() => undefined)),
      }),
    )
    .min(1, 'CO must have at least one line item'),
});

export type SaveCoDraftPayload = z.input<typeof SaveCoDraftInput>;

export async function saveCoDraft(input: SaveCoDraftPayload): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = SaveCoDraftInput.parse(input);

  // Confirm the project belongs to this tenant.
  const [project] = await db
    .select({ id: schema.projects.id })
    .from(schema.projects)
    .where(
      and(
        eq(schema.projects.id, parsed.projectId),
        eq(schema.projects.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!project) throw new Error('Project not found in current tenant');

  // Confirm the affected subcontract belongs to this project + tenant.
  if (parsed.affectedSubcontractId) {
    const [sub] = await db
      .select({ id: schema.subcontracts.id })
      .from(schema.subcontracts)
      .where(
        and(
          eq(schema.subcontracts.id, parsed.affectedSubcontractId),
          eq(schema.subcontracts.projectId, parsed.projectId),
          eq(schema.subcontracts.tenantId, tenant.id),
        ),
      )
      .limit(1);
    if (!sub) throw new Error('Subcontract not found on this project');
  }

  // Confirm every SoV line referenced belongs to this project + tenant.
  const sovLineIds = parsed.lines.map((l) => l.sovLineId);
  const validSovLines = await db
    .select({ id: schema.sovLines.id })
    .from(schema.sovLines)
    .where(
      and(
        inArray(schema.sovLines.id, sovLineIds),
        eq(schema.sovLines.projectId, parsed.projectId),
        eq(schema.sovLines.tenantId, tenant.id),
      ),
    );
  if (validSovLines.length !== sovLineIds.length) {
    throw new Error('One or more SoV lines not found on this project');
  }

  // Sum deltas server-side — never trust the client total.
  const totalAmount = parsed.lines.reduce(
    (sum, l) => sum + Number(l.deltaAmount),
    0,
  );

  // Insert CO + every line in one transaction so partial inserts can't
  // happen.
  await db.transaction(async (tx) => {
    const [co] = await tx
      .insert(schema.changeOrders)
      .values({
        tenantId: tenant.id,
        projectId: parsed.projectId,
        coNumber: parsed.coNumber,
        description: parsed.description,
        justification: parsed.justification ?? null,
        affectedSubcontractId: parsed.affectedSubcontractId ?? null,
        totalAmount: totalAmount.toFixed(2),
        status: 'draft',
        createdByUserId: user.id,
      })
      .returning({ id: schema.changeOrders.id });
    if (!co) throw new Error('CO insert returned no row');

    await tx.insert(schema.changeOrderLines).values(
      parsed.lines.map((l) => ({
        changeOrderId: co.id,
        sovLineId: l.sovLineId,
        deltaAmount: l.deltaAmount,
        reason: l.reason ?? null,
      })),
    );
  });

  revalidatePath(`/projects/${parsed.projectId}/change-orders`);
  redirect(`/projects/${parsed.projectId}/change-orders`);
}

// approveChangeOrder — the wedge feature.
//
// On owner approval (here shortcut to PM-direct for MVP demo before the
// magic-link chain is wired), the system in a SINGLE Postgres transaction:
//   1. Updates CO.status to 'approved' + sets approvedAt.
//   2. Increments subcontracts.current_amount by CO.total_amount (when an
//      affected subcontract is set).
//   3. For every CO line, increments sov_lines.current_amount by
//      delta_amount.
//   4. Inserts an approval_events row (the audit trail).
// If any step fails, the entire transaction rolls back. The CO stays
// in 'draft' and no subcontract or SoV row sees a partial update.
//
// The state-machine reducer in @constructor/domain owns the
// is-this-transition-legal check; SQL only happens after the reducer
// says yes. See gc-data-model.md § Invariant #4.

const ApproveChangeOrderInput = z.object({
  changeOrderId: z.string().uuid(),
  projectId: z.string().uuid(),
});

export async function approveChangeOrder(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const user = await ensureCurrentUser();
  const parsed = ApproveChangeOrderInput.parse({
    changeOrderId: formData.get('changeOrderId'),
    projectId: formData.get('projectId'),
  });

  // Read the CO inside the tenant scope.
  const [co] = await db
    .select({
      id: schema.changeOrders.id,
      projectId: schema.changeOrders.projectId,
      status: schema.changeOrders.status,
      totalAmount: schema.changeOrders.totalAmount,
      affectedSubcontractId: schema.changeOrders.affectedSubcontractId,
    })
    .from(schema.changeOrders)
    .where(
      and(
        eq(schema.changeOrders.id, parsed.changeOrderId),
        eq(schema.changeOrders.projectId, parsed.projectId),
        eq(schema.changeOrders.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!co) throw new Error('Change order not found');

  // The state machine guards the transition. We map the DB enum value
  // into the domain state shape; only the discriminator matters here.
  const transition = approveChangeOrderDirect({
    kind: co.status as 'draft',
  });
  if (!transition.ok) {
    throw new Error(transition.error);
  }

  // Read every line item so we can apply each delta to its SoV line.
  const lines = await db
    .select({
      sovLineId: schema.changeOrderLines.sovLineId,
      deltaAmount: schema.changeOrderLines.deltaAmount,
    })
    .from(schema.changeOrderLines)
    .where(eq(schema.changeOrderLines.changeOrderId, co.id));

  if (lines.length === 0) {
    throw new Error('Change order has no line items — cannot approve');
  }

  await db.transaction(async (tx) => {
    // 1. Flip the CO to approved.
    await tx
      .update(schema.changeOrders)
      .set({
        status: 'approved',
        approvedAt: new Date(),
      })
      .where(eq(schema.changeOrders.id, co.id));

    // 2. Increment the affected subcontract's current_amount, if any.
    if (co.affectedSubcontractId) {
      await tx
        .update(schema.subcontracts)
        .set({
          currentAmount: sql`${schema.subcontracts.currentAmount} + ${co.totalAmount}`,
        })
        .where(eq(schema.subcontracts.id, co.affectedSubcontractId));
    }

    // 3. Increment each affected SoV line by its delta.
    for (const line of lines) {
      await tx
        .update(schema.sovLines)
        .set({
          currentAmount: sql`${schema.sovLines.currentAmount} + ${line.deltaAmount}`,
        })
        .where(eq(schema.sovLines.id, line.sovLineId));
    }

    // 4. Audit row.
    await tx.insert(schema.approvalEvents).values({
      tenantId: tenant.id,
      entityType: 'change_order',
      entityId: co.id,
      fromStatus: 'draft',
      toStatus: 'approved',
      actorType: 'internal_user',
      actorUserId: user.id,
      comment: 'PM-direct approval (MVP demo path; magic-link chain TBD)',
    });
  });

  // Refresh the surfaces that show derived values.
  revalidatePath(`/projects/${parsed.projectId}`); // SoV editor
  revalidatePath(`/projects/${parsed.projectId}/subs`); // Subs tab
  revalidatePath(`/projects/${parsed.projectId}/change-orders`); // CO list
}

// sendApprovalLink — generate a single-use, time-bound magic-link that an
// external owner can click to approve or reject this CO without an account.
//
// MVP scope: skips Principal + Architect intermediate steps; the link goes
// straight to the owner. Real flow with the full chain layers on later.
//
// Generates a 256-bit random token, stores only its SHA-256 hash, and
// transitions the CO to pending_owner inside a single transaction so the
// state and the link are consistent. Default expiry 72 hours per the
// state-machine spec.

const SendApprovalLinkInput = z.object({
  changeOrderId: z.string().uuid(),
  projectId: z.string().uuid(),
  recipientEmail: z.string().trim().email().max(200),
});

const MAGIC_LINK_TTL_HOURS = 72;

export async function sendApprovalLink(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const parsed = SendApprovalLinkInput.parse({
    changeOrderId: formData.get('changeOrderId'),
    projectId: formData.get('projectId'),
    recipientEmail: formData.get('recipientEmail'),
  });

  // Read the CO inside the tenant scope and confirm it's eligible.
  const [co] = await db
    .select({
      id: schema.changeOrders.id,
      status: schema.changeOrders.status,
    })
    .from(schema.changeOrders)
    .where(
      and(
        eq(schema.changeOrders.id, parsed.changeOrderId),
        eq(schema.changeOrders.projectId, parsed.projectId),
        eq(schema.changeOrders.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!co) throw new Error('Change order not found');

  // Reducer guards the transition; we only insert if the move is legal.
  // A magicLinkId placeholder is fine here — the reducer doesn't read it,
  // it just propagates it into the next state shape.
  const transition = sendDraftToOwner(
    { kind: co.status as 'draft' },
    'pending-insert',
  );
  if (!transition.ok) throw new Error(transition.error);

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_TTL_HOURS * 60 * 60 * 1000,
  );

  await db.transaction(async (tx) => {
    await tx.insert(schema.magicLinks).values({
      tenantId: tenant.id,
      targetEntityType: 'change_order',
      targetEntityId: co.id,
      recipientEmail: parsed.recipientEmail,
      recipientRole: 'owner',
      tokenHash,
      action: 'approve_or_reject',
      expiresAt,
    });

    await tx
      .update(schema.changeOrders)
      .set({ status: 'pending_owner' })
      .where(eq(schema.changeOrders.id, co.id));
  });

  // Surface the raw token to the requester via revalidatePath + a query
  // param on the redirect target. Email delivery (Resend) lands later;
  // for now the URL is shown in-app so the user can click it themselves.
  revalidatePath(`/projects/${parsed.projectId}/change-orders`);
  redirect(
    `/projects/${parsed.projectId}/change-orders?token=${rawToken}&coId=${co.id}`,
  );
}
