import { numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { projects } from './project';
import { subcontracts } from './subcontract';
import { tenants } from './tenant';
import { users } from './user';

// A change to project scope. On transition to 'approved', propagation runs
// atomically across Subcontract.current_amount and SoVLine.current_amount.
// See docs/gc-state-machines.md § ChangeOrder and Invariant #4.
export const changeOrderStatus = pgEnum('change_order_status', [
  'draft',
  'pending_principal',
  'pending_architect',
  'architect_rejected',
  'pending_owner',
  'owner_rejected',
  'approved',
  'cancelled',
]);

export const changeOrders = pgTable('change_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id),
  coNumber: text('co_number').notNull(),
  description: text('description').notNull(),
  justification: text('justification'),
  affectedSubcontractId: uuid('affected_subcontract_id').references(() => subcontracts.id),
  totalAmount: numeric('total_amount', { precision: 14, scale: 2 }).notNull(),
  status: changeOrderStatus('status').notNull().default('draft'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  createdByUserId: uuid('created_by_user_id')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type ChangeOrder = typeof changeOrders.$inferSelect;
export type NewChangeOrder = typeof changeOrders.$inferInsert;
