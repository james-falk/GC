import { numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { documentAttachments } from './document-attachment';
import { projects } from './project';
import { subcontractors } from './subcontractor';
import { tenants } from './tenant';

// The agreement between a Project and a Subcontractor. Carries the contract
// amount and the running ceiling enforced by invariant #1.
// See docs/gc-data-model.md § Subcontract.
//
// current_amount is *derived*: original_amount + sum of approved CO line
// amounts that target this subcontract. Cached for query performance and
// updated atomically on CO approval (see ChangeOrder propagation rule).
export const subcontractStatus = pgEnum('subcontract_status', ['draft', 'active', 'closed']);

export const subcontracts = pgTable('subcontracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  subcontractorId: uuid('subcontractor_id')
    .notNull()
    .references(() => subcontractors.id),
  contractNumber: text('contract_number').notNull(),
  originalAmount: numeric('original_amount', { precision: 14, scale: 2 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 14, scale: 2 }).notNull(),
  specSections: text('spec_sections').array(),
  inclusions: text('inclusions'),
  exclusions: text('exclusions'),
  status: subcontractStatus('status').notNull().default('draft'),
  signedContractAttachmentId: uuid('signed_contract_attachment_id').references(
    () => documentAttachments.id,
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Subcontract = typeof subcontracts.$inferSelect;
export type NewSubcontract = typeof subcontracts.$inferInsert;
