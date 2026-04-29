import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

// Top of the multi-tenant hierarchy. Every other entity carries tenant_id FK.
// See docs/gc-data-model.md § Tenant.
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
