import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenant';

// External-party access tokens scoped to a single action. Single-use:
// consumed_at is set on first action; subsequent visits return 410 Gone.
// Raw token never stored — only the hash. See Invariant #7.
export const magicLinkRecipientRole = pgEnum('magic_link_recipient_role', [
  'architect',
  'owner',
  'sub_user',
]);

export const magicLinkAction = pgEnum('magic_link_action', ['review_only', 'approve_or_reject']);

export const magicLinks = pgTable('magic_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  targetEntityType: text('target_entity_type').notNull(),
  targetEntityId: uuid('target_entity_id').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  recipientRole: magicLinkRecipientRole('recipient_role').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  action: magicLinkAction('action').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type MagicLink = typeof magicLinks.$inferSelect;
export type NewMagicLink = typeof magicLinks.$inferInsert;
