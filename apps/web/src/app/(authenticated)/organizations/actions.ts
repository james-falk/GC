'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, schema } from '@constructor/db';
import { getCurrentTenant } from '@/lib/tenant';

// External organization directory CRUD. Owner orgs (project owners,
// public school districts, hospital systems, developers, etc.) and
// architect firms are both stored here and distinguished by `type`.
//
// Reusable across projects: when a project is created, you pick its
// owner + architect from this directory (added in Round 1c).

const NewOrganizationInput = z.object({
  name: z.string().trim().min(1, 'required').max(200),
  type: z.enum(['owner', 'architect']),
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

export async function createOrganization(formData: FormData) {
  const tenant = await getCurrentTenant();
  const parsed = NewOrganizationInput.parse({
    name: formData.get('name'),
    type: formData.get('type'),
    contactEmail: formData.get('contactEmail'),
    contactPhone: formData.get('contactPhone'),
    address: formData.get('address'),
  });

  await db.insert(schema.organizations).values({
    tenantId: tenant.id,
    name: parsed.name,
    type: parsed.type,
    contactEmail: parsed.contactEmail ?? null,
    contactPhone: parsed.contactPhone ?? null,
    address: parsed.address ?? null,
  });

  revalidatePath('/organizations');
  redirect('/organizations');
}
