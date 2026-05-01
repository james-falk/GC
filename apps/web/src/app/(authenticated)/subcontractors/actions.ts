'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
