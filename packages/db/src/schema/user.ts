import { pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenant';

// See docs/gc-data-model.md § User.
// tenant_id is nullable for external invitees (architects, owners) who reach
// the app via magic-link without a tenant of their own.
//
// role is nullable because Clerk's user.created event fires before any
// organization membership exists — we capture clerk_user_id + email at
// sign-up and populate (tenant_id, role) when organizationMembership.*
// events are wired.
export const userRole = pgEnum('user_role', [
  'principal',
  'finance',
  'pm',
  'assistant',
  'sub_user',
  'architect',
  'owner',
]);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    role: userRole('role'),
    clerkUserId: text('clerk_user_id').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    tenantEmailUnique: unique('users_tenant_email_unique').on(t.tenantId, t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
