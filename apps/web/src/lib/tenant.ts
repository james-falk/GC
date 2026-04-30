import { auth } from '@clerk/nextjs/server';
import { db, schema } from '@constructor/db';
import { eq } from 'drizzle-orm';

// Server-side helper. Resolves the active Clerk org to its tenants row.
// Throws if no org is active or if the org isn't synced yet — both indicate
// a real problem worth surfacing rather than silently falling back.
export async function getCurrentTenant() {
  const { orgId } = await auth();
  if (!orgId) {
    throw new Error(
      'No active Clerk organization. Use the OrganizationSwitcher in the top bar to select one.',
    );
  }
  const [tenant] = await db
    .select()
    .from(schema.tenants)
    .where(eq(schema.tenants.clerkOrgId, orgId))
    .limit(1);
  if (!tenant) {
    throw new Error(
      `Clerk org ${orgId} is not synced to the tenants table. Check that the organization.* webhook is firing.`,
    );
  }
  return tenant;
}
