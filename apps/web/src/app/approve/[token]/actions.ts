'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import {
  architectApproveCo,
  architectRejectCo,
  buildPropagationOps,
  ownerApproveChangeOrder,
  ownerRejectChangeOrder,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { applyPropagationOp } from '@/lib/co-propagation-tx';
import {
  generateRawToken,
  hashToken,
  TOKEN_PATTERN,
  loadValidLink,
} from '@/lib/magic-link';

// Magic-link consumer-side actions. Public — no Clerk auth. The token
// itself is the bearer credential; we hash it and look up the magic_links
// row, then verify it's unconsumed and unexpired before doing anything.
//
// Currently handles owner-role magic-links targeting change_orders. The
// owner_approve transition triggers atomic propagation: a single
// transaction updates the CO status, the affected subcontract's
// current_amount, every affected SoV line's current_amount, the
// magic-link's consumed_at, and inserts an approval_events audit row.
// All-or-nothing — gc-data-model.md § Invariant #4.

const ApproveInput = z.object({
  token: z.string().regex(TOKEN_PATTERN, 'invalid token'),
});

const RejectInput = z.object({
  token: z.string().regex(TOKEN_PATTERN, 'invalid token'),
  comment: z.string().trim().min(1, 'comment is required').max(2000),
});

export async function approveViaMagicLink(formData: FormData): Promise<void> {
  const parsed = ApproveInput.parse({
    token: formData.get('token'),
  });
  const link = await loadValidLink(parsed.token);

  if (link.targetEntityType !== 'change_order') {
    throw new Error(
      `magic-link target ${link.targetEntityType} not yet supported`,
    );
  }
  if (link.recipientRole !== 'owner' && link.recipientRole !== 'architect') {
    throw new Error(
      `magic-link role ${link.recipientRole} not supported on this consumer`,
    );
  }

  // Architect approval: transition pending_architect → pending_owner AND
  // create the owner magic-link in the same transaction. Architect path
  // doesn't trigger propagation (that's owner approval below).
  if (link.recipientRole === 'architect') {
    return architectApproveAndForwardToOwner(parsed.token, link);
  }

  // Read the target CO (already scoped to the link's tenant — no Clerk
  // context here, the magic-link itself is the authority).
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
        eq(schema.changeOrders.id, link.targetEntityId),
        eq(schema.changeOrders.tenantId, link.tenantId),
      ),
    )
    .limit(1);
  if (!co) throw new Error('Change order not found');

  const transition = ownerApproveChangeOrder({
    kind: co.status as 'pending_owner',
    magicLinkId: link.id,
    at: new Date(),
  });
  if (!transition.ok) throw new Error(transition.error);

  const lines = await db
    .select({
      sovLineId: schema.changeOrderLines.sovLineId,
      deltaAmount: schema.changeOrderLines.deltaAmount,
    })
    .from(schema.changeOrderLines)
    .where(eq(schema.changeOrderLines.changeOrderId, co.id));
  if (lines.length === 0) {
    throw new Error('Change order has no line items');
  }

  // Pure op list from @constructor/domain — same source of truth as the
  // PM-direct path. The SQL adapter (applyPropagationOp) lives in
  // apps/web/src/lib/co-propagation-tx.ts.
  const propagationOps = buildPropagationOps({
    changeOrderId: co.id,
    totalAmount: co.totalAmount,
    affectedSubcontractId: co.affectedSubcontractId,
    lines,
  });

  await db.transaction(async (tx) => {
    for (const op of propagationOps) {
      await applyPropagationOp(tx, op);
    }

    // Mark the magic-link consumed (consumer-path only).
    await tx
      .update(schema.magicLinks)
      .set({ consumedAt: new Date() })
      .where(eq(schema.magicLinks.id, link.id));

    // Audit row — actor is the external invitee from the link.
    await tx.insert(schema.approvalEvents).values({
      tenantId: link.tenantId,
      entityType: 'change_order',
      entityId: co.id,
      fromStatus: 'pending_owner',
      toStatus: 'approved',
      actorType: 'external_invitee',
      actorExternalEmail: link.recipientEmail,
      comment: 'Approved via magic-link',
    });
  });

  // Refresh GC-side surfaces. The /approve page itself doesn't need
  // revalidation — we redirect with a status flag.
  revalidatePath(`/projects/${co.projectId}`);
  revalidatePath(`/projects/${co.projectId}/subs`);
  revalidatePath(`/projects/${co.projectId}/change-orders`);

  redirect(`/approve/${parsed.token}?status=approved`);
}

export async function rejectViaMagicLink(formData: FormData): Promise<void> {
  const parsed = RejectInput.parse({
    token: formData.get('token'),
    comment: formData.get('comment'),
  });
  const link = await loadValidLink(parsed.token);

  if (link.targetEntityType !== 'change_order') {
    throw new Error(
      `magic-link target ${link.targetEntityType} not yet supported`,
    );
  }
  if (link.recipientRole !== 'owner' && link.recipientRole !== 'architect') {
    throw new Error(
      `magic-link role ${link.recipientRole} not supported on this consumer`,
    );
  }

  if (link.recipientRole === 'architect') {
    return architectRejectViaMagicLink(parsed.token, link, parsed.comment);
  }

  const [co] = await db
    .select({
      id: schema.changeOrders.id,
      projectId: schema.changeOrders.projectId,
      status: schema.changeOrders.status,
    })
    .from(schema.changeOrders)
    .where(
      and(
        eq(schema.changeOrders.id, link.targetEntityId),
        eq(schema.changeOrders.tenantId, link.tenantId),
      ),
    )
    .limit(1);
  if (!co) throw new Error('Change order not found');

  const transition = ownerRejectChangeOrder(
    {
      kind: co.status as 'pending_owner',
      magicLinkId: link.id,
      at: new Date(),
    },
    parsed.comment,
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.changeOrders)
      .set({ status: 'owner_rejected' })
      .where(eq(schema.changeOrders.id, co.id));

    await tx
      .update(schema.magicLinks)
      .set({ consumedAt: new Date() })
      .where(eq(schema.magicLinks.id, link.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: link.tenantId,
      entityType: 'change_order',
      entityId: co.id,
      fromStatus: 'pending_owner',
      toStatus: 'owner_rejected',
      actorType: 'external_invitee',
      actorExternalEmail: link.recipientEmail,
      comment: parsed.comment,
    });
  });

  revalidatePath(`/projects/${co.projectId}/change-orders`);

  redirect(`/approve/${parsed.token}?status=rejected`);
}

const ARCHITECT_TO_OWNER_LINK_TTL_HOURS = 72;

// Architect approval: transitions pending_architect → pending_owner AND
// generates the owner magic-link in the same transaction. Owner email
// resolved from project.ownerId → organization.contact_email.
async function architectApproveAndForwardToOwner(
  token: string,
  link: typeof schema.magicLinks.$inferSelect,
): Promise<void> {
  const [co] = await db
    .select({
      id: schema.changeOrders.id,
      projectId: schema.changeOrders.projectId,
      status: schema.changeOrders.status,
      projectOwnerId: schema.projects.ownerId,
    })
    .from(schema.changeOrders)
    .innerJoin(
      schema.projects,
      eq(schema.changeOrders.projectId, schema.projects.id),
    )
    .where(
      and(
        eq(schema.changeOrders.id, link.targetEntityId),
        eq(schema.changeOrders.tenantId, link.tenantId),
      ),
    )
    .limit(1);
  if (!co) throw new Error('Change order not found');

  if (!co.projectOwnerId) {
    throw new Error(
      'Project has no owner organization attached — cannot forward to owner.',
    );
  }
  const [owner] = await db
    .select({ email: schema.organizations.contactEmail })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, co.projectOwnerId))
    .limit(1);
  if (!owner || !owner.email) {
    throw new Error('Owner organization has no contact email — add one first.');
  }
  const ownerEmail = owner.email;

  const transition = architectApproveCo(
    co.status as Parameters<typeof architectApproveCo>[0],
    'pending-insert',
  );
  if (!transition.ok) throw new Error(transition.error);

  const rawOwnerToken = generateRawToken();
  const ownerTokenHash = hashToken(rawOwnerToken);
  const expiresAt = new Date(
    Date.now() + ARCHITECT_TO_OWNER_LINK_TTL_HOURS * 60 * 60 * 1000,
  );

  await db.transaction(async (tx) => {
    await tx
      .update(schema.changeOrders)
      .set({ status: 'pending_owner' })
      .where(eq(schema.changeOrders.id, co.id));

    await tx
      .update(schema.magicLinks)
      .set({ consumedAt: new Date() })
      .where(eq(schema.magicLinks.id, link.id));

    await tx.insert(schema.magicLinks).values({
      tenantId: link.tenantId,
      targetEntityType: 'change_order',
      targetEntityId: co.id,
      recipientEmail: ownerEmail,
      recipientRole: 'owner',
      tokenHash: ownerTokenHash,
      action: 'approve_or_reject',
      expiresAt,
    });

    await tx.insert(schema.approvalEvents).values({
      tenantId: link.tenantId,
      entityType: 'change_order',
      entityId: co.id,
      fromStatus: 'pending_architect',
      toStatus: 'pending_owner',
      actorType: 'external_invitee',
      actorExternalEmail: link.recipientEmail,
      comment: `Architect approved; forwarded to owner ${ownerEmail}`,
    });
  });

  revalidatePath(`/projects/${co.projectId}/change-orders`);
  // Architect's success page tells them their part is done. The owner
  // URL is shown to the GC via the change-orders dashboard banner on
  // their next page load.
  redirect(`/approve/${token}?status=approved`);
}

async function architectRejectViaMagicLink(
  token: string,
  link: typeof schema.magicLinks.$inferSelect,
  comment: string,
): Promise<void> {
  const [co] = await db
    .select({
      id: schema.changeOrders.id,
      projectId: schema.changeOrders.projectId,
      status: schema.changeOrders.status,
    })
    .from(schema.changeOrders)
    .where(
      and(
        eq(schema.changeOrders.id, link.targetEntityId),
        eq(schema.changeOrders.tenantId, link.tenantId),
      ),
    )
    .limit(1);
  if (!co) throw new Error('Change order not found');

  const transition = architectRejectCo(
    co.status as Parameters<typeof architectRejectCo>[0],
    comment,
  );
  if (!transition.ok) throw new Error(transition.error);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.changeOrders)
      .set({ status: 'architect_rejected' })
      .where(eq(schema.changeOrders.id, co.id));

    await tx
      .update(schema.magicLinks)
      .set({ consumedAt: new Date() })
      .where(eq(schema.magicLinks.id, link.id));

    await tx.insert(schema.approvalEvents).values({
      tenantId: link.tenantId,
      entityType: 'change_order',
      entityId: co.id,
      fromStatus: 'pending_architect',
      toStatus: 'architect_rejected',
      actorType: 'external_invitee',
      actorExternalEmail: link.recipientEmail,
      comment,
    });
  });

  revalidatePath(`/projects/${co.projectId}/change-orders`);
  redirect(`/approve/${token}?status=rejected`);
}
