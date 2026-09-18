import {
  pgTable,
  uuid,
  varchar,
  date,
  numeric,
  timestamp,
  index,
  text,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const cpaTypes = ['fixed', 'percent'] as const;
export type CpaType = (typeof cpaTypes)[number];

/**
 * Empty string on scope columns means "any" (matches blank CSV cells).
 * Specificity ladder: product → price_point → affiliate → sub_affiliate.
 */
export const cpaRules = pgTable(
  'cpa_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: varchar('rule_id', { length: 32 }).notNull().unique(),
    product: varchar('product', { length: 120 }).notNull().default(''),
    /** Stored normalized (e.g. "49"), never "49.00". */
    pricePoint: varchar('price_point', { length: 32 }).notNull().default(''),
    affiliate: varchar('affiliate', { length: 64 }).notNull().default(''),
    subAffiliate: varchar('sub_affiliate', { length: 64 }).notNull().default(''),
    cpaType: varchar('cpa_type', { length: 16 }).notNull(),
    cpaValue: numeric('cpa_value', { precision: 12, scale: 4 }).notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    /** Bitmask-style rank 0–4 for how many scope fields are set. */
    specificityScore: integer('specificity_score').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    notes: text('notes'),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cpa_rules_product_idx').on(table.product),
    index('cpa_rules_affiliate_idx').on(table.affiliate),
    index('cpa_rules_sub_affiliate_idx').on(table.subAffiliate),
    index('cpa_rules_effective_idx').on(table.effectiveFrom, table.effectiveTo),
    index('cpa_rules_active_spec_idx').on(table.isActive, table.specificityScore),
    index('cpa_rules_match_idx').on(
      table.product,
      table.pricePoint,
      table.affiliate,
      table.subAffiliate,
      table.effectiveFrom,
    ),
  ],
);

export type CpaRule = typeof cpaRules.$inferSelect;
export type NewCpaRule = typeof cpaRules.$inferInsert;
