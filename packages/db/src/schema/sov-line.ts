import { numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { projects } from './project';
import { subcontracts } from './subcontract';
import { tenants } from './tenant';

// A line item in the project's Schedule of Values. Hierarchical via
// parent_line_id (NULL = top-level). Children break a parent down further
// (e.g. line "3" with children "3a", "3b").
// subcontract_id NULL means the line is a GC-internal cost (bonding, permits).
// See docs/gc-data-model.md § SoVLine and Invariant #2.
export const sovLines = pgTable('sov_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  parentLineId: uuid('parent_line_id').references((): AnyPgColumn => sovLines.id),
  lineNumber: text('line_number').notNull(),
  description: text('description').notNull(),
  subcontractId: uuid('subcontract_id').references(() => subcontracts.id),
  contractAmount: numeric('contract_amount', { precision: 14, scale: 2 }).notNull(),
  currentAmount: numeric('current_amount', { precision: 14, scale: 2 }).notNull(),
  storedMaterialsAmount: numeric('stored_materials_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type SovLine = typeof sovLines.$inferSelect;
export type NewSovLine = typeof sovLines.$inferInsert;
