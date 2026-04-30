import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenant';
import { users } from './user';

// Append-only audit trail for state transitions on ChangeOrder, PayApplication,
// and SwornStatement. entity_type/entity_id is polymorphic.
// See docs/gc-data-model.md § ApprovalEvent.
export const approvalActorType = pgEnum('approval_actor_type', [
  'internal_user',
  'external_invitee',
  'system',
]);

export const approvalEvents = pgTable('approval_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  actorType: approvalActorType('actor_type').notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id),
  actorExternalEmail: text('actor_external_email'),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ApprovalEvent = typeof approvalEvents.$inferSelect;
export type NewApprovalEvent = typeof approvalEvents.$inferInsert;
