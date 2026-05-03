'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import {
  ownerApproveChangeOrder,
  ownerRejectChangeOrder,
} from '@constructor/domain';
import { db, schema } from '@constructor/db';
import { TOKEN_PATTERN, loadValidLink } from '@/lib/magic-link';

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
  if (link.recipientRole !== 'owner') {
    throw new Error(
      `magic-link role ${link.recipientRole} not yet supported`,
    );
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

  await db.transaction(async (tx) => {
    // 1. Flip the CO to approved.
    await tx
      .update(schema.changeOrders)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(eq(schema.changeOrders.id, co.id));

    // 2. Increment the affected subcontract.
    if (co.affectedSubcontractId) {
      await tx
        .update(schema.subcontracts)
        .set({
          currentAmount: sql`${schema.subcontracts.currentAmount} + ${co.totalAmount}`,
        })
        .where(eq(schema.subcontracts.id, co.affectedSubcontractId));
    }

    // 3. Increment every affected SoV line.
    for (const line of lines) {
      await tx
        .update(schema.sovLines)
        .set({
          currentAmount: sql`${schema.sovLines.currentAmount} + ${line.deltaAmount}`,
        })
        .where(eq(schema.sovLines.id, line.sovLineId));
    }

    // 4. Mark the magic-link consumed.
    await tx
      .update(schema.magicLinks)
      .set({ consumedAt: new Date() })
      .where(eq(schema.magicLinks.id, link.id));

    // 5. Audit row.
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
  if (link.recipientRole !== 'owner') {
    throw new Error(
      `magic-link role ${link.recipientRole} not yet supported`,
    );
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
