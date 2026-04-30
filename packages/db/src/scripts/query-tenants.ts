// Ad-hoc query script: list all tenants. Useful for verifying webhook syncs.
// Run via: pnpm --filter @constructor/db exec dotenv -e ../../apps/web/.env.local -- tsx src/scripts/query-tenants.ts

import { db, schema } from '../index';
import { desc } from 'drizzle-orm';

async function main() {
  const rows = await db
    .select()
    .from(schema.tenants)
    .orderBy(desc(schema.tenants.createdAt))
    .limit(10);

  if (rows.length === 0) {
    console.log('(no tenants yet)');
  } else {
    console.log(`${rows.length} tenant(s):\n`);
    for (const t of rows) {
      console.log(
        `  id=${t.id}\n  clerk_org_id=${t.clerkOrgId}\n  name=${t.name}\n  slug=${t.slug}\n  created_at=${t.createdAt.toISOString()}\n`,
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
