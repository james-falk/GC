import { numeric, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { changeOrders } from './change-order';
import { sovLines } from './sov-line';

// A single add or deduct against a SoVLine, owned by a ChangeOrder.
// On CO approval, delta_amount propagates into SoVLine.current_amount
// atomically (Invariant #4).
// See docs/gc-data-model.md § ChangeOrderLine.
export const changeOrderLines = pgTable('change_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  changeOrderId: uuid('change_order_id')
    .notNull()
    .references(() => changeOrders.id, { onDelete: 'cascade' }),
  sovLineId: uuid('sov_line_id')
    .notNull()
    .references(() => sovLines.id),
  deltaAmount: numeric('delta_amount', { precision: 14, scale: 2 }).notNull(),
  reason: text('reason'),
});

export type ChangeOrderLine = typeof changeOrderLines.$inferSelect;
export type NewChangeOrderLine = typeof changeOrderLines.$inferInsert;
