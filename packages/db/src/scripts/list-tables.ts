// Ad-hoc verification: list all tables in the public schema and their column
// counts. Useful for confirming a migration applied as expected.
// Run via: pnpm --filter @constructor/db exec dotenv -e ../../apps/web/.env.local -- tsx src/scripts/list-tables.ts

import { sql } from 'drizzle-orm';
import { db } from '../index';

async function main() {
  const rows = await db.execute<{ table_name: string; column_count: number }>(sql`
    SELECT t.table_name,
           (SELECT count(*)::int FROM information_schema.columns c
            WHERE c.table_schema = 'public' AND c.table_name = t.table_name) AS column_count
    FROM information_schema.tables t
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    ORDER BY t.table_name;
  `);

  console.log(`${rows.length} table(s) in public schema:\n`);
  for (const r of rows) {
    console.log(`  ${r.table_name.padEnd(30)} ${r.column_count} cols`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
