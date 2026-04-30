import { date, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { organizations } from './organization';
import { tenants } from './tenant';

// A construction project owned by the GC.
// See docs/gc-data-model.md § Project.
export const projectStatus = pgEnum('project_status', ['draft', 'active', 'on_hold', 'closed']);

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  projectNumber: text('project_number').notNull(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => organizations.id),
  architectId: uuid('architect_id').references(() => organizations.id),
  originalContractAmount: numeric('original_contract_amount', { precision: 14, scale: 2 }).notNull(),
  status: projectStatus('status').notNull().default('draft'),
  startDate: date('start_date'),
  targetCompletionDate: date('target_completion_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
