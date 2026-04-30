import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';

// Clerk → tenants/users sync. Triggered by organization.* and user.* events.
// Configure the webhook endpoint URL in the Clerk Dashboard → Webhooks
// (point at /api/webhooks/clerk on your deployment URL) and copy the
// signing secret into CLERK_WEBHOOK_SECRET.
//
// Subscribed events (recommended):
//   organization.created, organization.updated, organization.deleted
//   user.created, user.updated, user.deleted
//
// Not yet subscribed: organizationMembership.* — when wired, those events
// will populate users.tenant_id and users.role. Until then, user rows are
// created with both fields NULL.
//
// Signature is verified with svix; missing or invalid signatures return 401.
// Unknown event types are acknowledged with 200 (so Clerk doesn't retry).

type ClerkOrganization = {
  id: string;
  name: string;
  slug: string;
};

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUser = {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
};

type ClerkEvent =
  | { type: 'organization.created'; data: ClerkOrganization }
  | { type: 'organization.updated'; data: ClerkOrganization }
  | { type: 'organization.deleted'; data: { id: string } }
  | { type: 'user.created'; data: ClerkUser }
  | { type: 'user.updated'; data: ClerkUser }
  | { type: 'user.deleted'; data: { id: string } }
  | { type: string; data: unknown };

function pickPrimaryEmail(user: ClerkUser): string | null {
  if (!user.primary_email_address_id) return null;
  const primary = user.email_addresses.find(
    (e) => e.id === user.primary_email_address_id,
  );
  return primary?.email_address ?? null;
}

function pickDisplayName(user: ClerkUser, email: string): string {
  const fullName = [user.first_name, user.last_name]
    .filter((s): s is string => Boolean(s))
    .join(' ')
    .trim();
  return fullName || user.username || email;
}

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

    case 'user.created': {
      const user = event.data as ClerkUser;
      const email = pickPrimaryEmail(user);
      if (!email) {
        console.warn(`Clerk user ${user.id} has no primary email — skipping insert`);
        break;
      }
      await db
        .insert(schema.users)
        .values({
          clerkUserId: user.id,
          email,
          displayName: pickDisplayName(user, email),
        })
        .onConflictDoNothing({ target: schema.users.clerkUserId });
      break;
    }

    case 'user.updated': {
      const user = event.data as ClerkUser;
      const email = pickPrimaryEmail(user);
      if (!email) {
        console.warn(`Clerk user ${user.id} has no primary email — skipping update`);
        break;
      }
      await db
        .update(schema.users)
        .set({
          email,
          displayName: pickDisplayName(user, email),
        })
        .where(eq(schema.users.clerkUserId, user.id));
      break;
    }

    case 'user.deleted': {
      // Mirrors organization.deleted: log and no-op. Real cleanup will use a
      // soft-delete column once one is added to users.
      const userId = (event.data as { id: string }).id;
      console.log(`Clerk user ${userId} deleted — no-op (soft delete TBD)`);
      break;
    }

    default:
      // Unknown event — acknowledge so Clerk doesn't retry.
      break;
  }

  return new Response('OK', { status: 200 });
}
