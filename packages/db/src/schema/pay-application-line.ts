import { numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { payApplications } from './pay-application';
import { sovLines } from './sov-line';

// One line in a pay application, scoped to a specific SoVLine.
// previously_billed_amount is a snapshot at submission time so retroactive
// SoV edits don't silently rewrite history.
// See docs/gc-data-model.md § PayApplicationLine.
export const payApplicationLines = pgTable('pay_application_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  payApplicationId: uuid('pay_application_id')
    .notNull()
    .references(() => payApplications.id, { onDelete: 'cascade' }),
  sovLineId: uuid('sov_line_id')
    .notNull()
    .references(() => sovLines.id),
  previouslyBilledAmount: numeric('previously_billed_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0'),
  subReportedPercent: numeric('sub_reported_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('0'),
  gcAdjustedPercent: numeric('gc_adjusted_percent', { precision: 5, scale: 2 })
    .notNull()
    .default('0'),
  thisPeriodAmount: numeric('this_period_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0'),
  storedMaterialsAmount: numeric('stored_materials_amount', { precision: 14, scale: 2 })
    .notNull()
    .default('0'),
  retentionAmount: numeric('retention_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  gcNote: text('gc_note'),
});

export type PayApplicationLine = typeof payApplicationLines.$inferSelect;
export type NewPayApplicationLine = typeof payApplicationLines.$inferInsert;
