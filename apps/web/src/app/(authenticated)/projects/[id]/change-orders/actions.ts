'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';
import { ensureCurrentUser } from '@/lib/user';

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
