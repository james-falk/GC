import { bigint, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenant';
import { users } from './user';

// Polymorphic attachments — entity_type/entity_id pair points at any owning entity.
// See docs/gc-data-model.md § DocumentAttachment.
//
// entity_type values:
//   project | subcontract | pay_application | change_order |
//   sov_line | sworn_statement | subcontractor
// Kept as text (not pgEnum) because polymorphic targets evolve faster than
// we want to issue ALTER TYPE migrations for.
export const documentAttachments = pgTable('document_attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  filename: text('filename').notNull(),
  storageKey: text('storage_key').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  uploadedByUserId: uuid('uploaded_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type DocumentAttachment = typeof documentAttachments.$inferSelect;
export type NewDocumentAttachment = typeof documentAttachments.$inferInsert;
