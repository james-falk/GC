import { date, numeric, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './project';
import { subcontracts } from './subcontract';
import { tenants } from './tenant';

// A monthly pay request. direction distinguishes the two state machines:
//   sub_to_gc — submitted by a subcontractor up to the GC
//   gc_to_owner — assembled by the GC and sent to the project owner
// See docs/gc-state-machines.md §§ 1, 2 and docs/gc-data-model.md § PayApplication.
export const payAppDirection = pgEnum('pay_app_direction', ['sub_to_gc', 'gc_to_owner']);

// Union of states across both pay-app state machines. The valid set per row
// is determined by direction and enforced in the domain layer, not the DB.
export const payAppStatus = pgEnum('pay_app_status', [
  // Shared
  'draft',
  'cancelled',
  'paid',
  // SubPayApp
  'submitted',
  'needs_revision',
  'approved_by_pm',
  'approved_by_principal',
  'approved',
  'included_in_owner_pay_app',
  // OwnerPayApp
  'generated',
  'signed',
  'notarized',
  'sent_to_architect',
  'architect_rejected',
  'architect_approved',
  'sent_to_owner',
  'owner_rejected',
  'owner_approved',
]);

export const payApplications = pgTable('pay_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  direction: payAppDirection('direction').notNull(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  subcontractId: uuid('subcontract_id').references(() => subcontracts.id),
  status: payAppStatus('status').notNull().default('draft'),
  totalBilled: numeric('total_billed', { precision: 14, scale: 2 }).notNull().default('0'),
  totalRetention: numeric('total_retention', { precision: 14, scale: 2 }).notNull().default('0'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PayApplication = typeof payApplications.$inferSelect;
export type NewPayApplication = typeof payApplications.$inferInsert;
