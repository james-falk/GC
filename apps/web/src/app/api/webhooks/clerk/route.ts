import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';

// Clerk → tenants sync. Triggered by organization.* events from Clerk.
// Configure the webhook endpoint URL in the Clerk Dashboard → Webhooks
// (point at /api/webhooks/clerk on your deployment URL) and copy the
// signing secret into CLERK_WEBHOOK_SECRET.
//
// Subscribed events (recommended): organization.created, organization.updated,
// organization.deleted.
//
// Signature is verified with svix; missing or invalid signatures return 401.
// Unknown event types are acknowledged with 200 (so Clerk doesn't retry).

type ClerkOrganization = {
  id: string;
  name: string;
  slug: string;
};

type ClerkEvent =
  | { type: 'organization.created'; data: ClerkOrganization }
  | { type: 'organization.updated'; data: ClerkOrganization }
  | { type: 'organization.deleted'; data: { id: string } }
  | { type: string; data: unknown };

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('CLERK_WEBHOOK_SECRET is not configured');
    return new Response('Server misconfigured', { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);

  let event: ClerkEvent;
  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkEvent;
  } catch (err) {
    console.error('Clerk webhook signature verification failed', err);
    return new Response('Invalid signature', { status: 401 });
  }

  switch (event.type) {
    case 'organization.created': {
      const org = event.data as ClerkOrganization;
      await db
        .insert(schema.tenants)
        .values({
          clerkOrgId: org.id,
          name: org.name,
          slug: org.slug,
        })
        .onConflictDoNothing({ target: schema.tenants.clerkOrgId });
      break;
    }

    case 'organization.updated': {
      const org = event.data as ClerkOrganization;
      await db
        .update(schema.tenants)
        .set({ name: org.name, slug: org.slug })
        .where(eq(schema.tenants.clerkOrgId, org.id));
      break;
    }

    case 'organization.deleted': {
      // For MVP: log and no-op. Hard delete cascades through every tenant-scoped
      // entity which we'd rather not do silently. Soft delete pattern lands
      // when we add a deleted_at column to tenants.
      const orgId = (event.data as { id: string }).id;
      console.log(`Clerk org ${orgId} deleted — no-op (soft delete TBD)`);
      break;
    }

    default:
      // Unknown event — acknowledge so Clerk doesn't retry.
      break;
  }

  return new Response('OK', { status: 200 });
}
