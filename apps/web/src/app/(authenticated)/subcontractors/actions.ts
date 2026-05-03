'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// Subcontractor directory create. Minimal fields: name required, the rest
// optional. Per-project subcontracts (the agreements) live elsewhere and
// reference these directory entries.

const NewSubcontractorInput = z.object({
  name: z.string().trim().min(1, 'required').max(200),
  contactEmail: z
    .string()
    .trim()
    .email('must be a valid email')
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  contactPhone: z
    .string()
    .trim()
    .max(64)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  address: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export async function createSubcontractor(formData: FormData) {
  const tenant = await getCurrentTenant();
  const parsed = NewSubcontractorInput.parse({
    name: formData.get('name'),
    contactEmail: formData.get('contactEmail'),
    contactPhone: formData.get('contactPhone'),
    address: formData.get('address'),
  });

  await db.insert(schema.subcontractors).values({
    tenantId: tenant.id,
    name: parsed.name,
    contactEmail: parsed.contactEmail ?? null,
    contactPhone: parsed.contactPhone ?? null,
    address: parsed.address ?? null,
  });

  revalidatePath('/subcontractors');
  redirect('/subcontractors');
}

const UpdateSubcontractorInput = NewSubcontractorInput.extend({
  subcontractorId: z.string().uuid(),
});

export async function updateSubcontractor(formData: FormData): Promise<void> {
  const tenant = await getCurrentTenant();
  const parsed = UpdateSubcontractorInput.parse({
    subcontractorId: formData.get('subcontractorId'),
    name: formData.get('name'),
    contactEmail: formData.get('contactEmail'),
    contactPhone: formData.get('contactPhone'),
    address: formData.get('address'),
  });

  // Verify it belongs to this tenant.
  const [existing] = await db
    .select({ id: schema.subcontractors.id })
    .from(schema.subcontractors)
    .where(
      and(
        eq(schema.subcontractors.id, parsed.subcontractorId),
        eq(schema.subcontractors.tenantId, tenant.id),
      ),
    )
    .limit(1);
  if (!existing) {
    throw new Error('Subcontractor not found in this tenant');
  }

  await db
    .update(schema.subcontractors)
    .set({
      name: parsed.name,
      contactEmail: parsed.contactEmail ?? null,
      contactPhone: parsed.contactPhone ?? null,
      address: parsed.address ?? null,
    })
    .where(eq(schema.subcontractors.id, parsed.subcontractorId));

  revalidatePath('/subcontractors');
  redirect('/subcontractors');
}
