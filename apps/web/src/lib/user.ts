import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@constructor/db';

// Find-or-create the current user's row in the `users` table. Used by any
// server action that inserts into a table with `created_by_user_id NOT NULL`
// (change_orders, eventually pay_applications + approval_events).
//
// The Clerk user.* webhook usually populates `users` automatically, but
// it can lag (or fail silently in dev), so we don't trust it as the only
// path — we look up first, fall through to creation if missing.

export async function ensureCurrentUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Not authenticated');
  }

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, userId))
    .limit(1);
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new Error(`Clerk user ${userId} not found via API`);
  }

  const primaryEmail = clerkUser.emailAddresses.find(
    (e) => e.id === clerkUser.primaryEmailAddressId,
  )?.emailAddress;
  if (!primaryEmail) {
    throw new Error(`Clerk user ${userId} has no primary email`);
  }

  const fullName = [clerkUser.firstName, clerkUser.lastName]
    .filter((s): s is string => Boolean(s))
    .join(' ')
    .trim();
  const displayName = fullName || clerkUser.username || primaryEmail;

  const [created] = await db
    .insert(schema.users)
    .values({
      clerkUserId: userId,
      email: primaryEmail,
      displayName,
    })
    .onConflictDoNothing({ target: schema.users.clerkUserId })
    .returning();

  if (created) return created;

  // Race: another concurrent request inserted between our lookup and our
  // insert. Re-read.
  const [retry] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkUserId, userId))
    .limit(1);
  if (!retry) {
    throw new Error('Failed to find-or-create users row');
  }
  return retry;
}
