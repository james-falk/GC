import { pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { documentAttachments } from './document-attachment';
import { payApplications } from './pay-application';
import { tenants } from './tenant';

// Generated alongside an owner-direction pay app. Lifecycle parallels its
// parent OwnerPayApplication — see docs/gc-state-machines.md § 4.
export const swornStatementStatus = pgEnum('sworn_statement_status', [
  'generated',
  'signed',
  'notarized',
  'sent_to_architect',
  'architect_approved',
  'sent_to_owner',
  'owner_approved',
  'archived',
]);

export const swornStatements = pgTable('sworn_statements', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  payApplicationId: uuid('pay_application_id')
    .notNull()
    .references(() => payApplications.id),
  generatedPdfAttachmentId: uuid('generated_pdf_attachment_id')
    .notNull()
    .references(() => documentAttachments.id),
  signedPdfAttachmentId: uuid('signed_pdf_attachment_id').references(() => documentAttachments.id),
  notarizedPdfAttachmentId: uuid('notarized_pdf_attachment_id').references(
    () => documentAttachments.id,
  ),
  status: swornStatementStatus('status').notNull().default('generated'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SwornStatement = typeof swornStatements.$inferSelect;
export type NewSwornStatement = typeof swornStatements.$inferInsert;
