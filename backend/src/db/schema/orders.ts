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
import { cpaRules } from './rules.js';

export const commissionStatuses = ['pending', 'resolved', 'no_rule'] as const;
export type CommissionStatus = (typeof commissionStatuses)[number];

/**
 * Orders fact table. Commission fields are filled by the engine.
 * Money uses numeric(12,2) for clarity; document cents option in README.
 */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: varchar('order_id', { length: 32 }).notNull().unique(),
    orderDate: date('order_date').notNull(),
    affiliateCode: varchar('affiliate_code', { length: 64 }).notNull().default(''),
    subAffiliateCode: varchar('sub_affiliate_code', { length: 64 }).notNull().default(''),
    product1Name: varchar('product_1_name', { length: 120 }).notNull(),
    product1Price: numeric('product_1_price', { precision: 12, scale: 2 }).notNull(),
    /** Normalized front-end price key for rule matching, e.g. "49". */
    pricePoint: varchar('price_point', { length: 32 }).notNull().default(''),
    product2Name: varchar('product_2_name', { length: 120 }),
    product2Price: numeric('product_2_price', { precision: 12, scale: 2 }),
    product3Name: varchar('product_3_name', { length: 120 }),
    product3Price: numeric('product_3_price', { precision: 12, scale: 2 }),
    product4Name: varchar('product_4_name', { length: 120 }),
    product4Price: numeric('product_4_price', { precision: 12, scale: 2 }),
    product5Name: varchar('product_5_name', { length: 120 }),
    product5Price: numeric('product_5_price', { precision: 12, scale: 2 }),
    frontendRevenue: numeric('frontend_revenue', { precision: 12, scale: 2 }),
    upsellRevenue: numeric('upsell_revenue', { precision: 12, scale: 2 }),
    totalRevenue: numeric('total_revenue', { precision: 12, scale: 2 }),
    commission: numeric('commission', { precision: 12, scale: 2 }),
    commissionStatus: varchar('commission_status', { length: 16 })
      .notNull()
      .default('pending'),
    appliedRuleId: varchar('applied_rule_id', { length: 32 }),
    appliedRuleUuid: uuid('applied_rule_uuid').references(() => cpaRules.id),
    appliedCpaType: varchar('applied_cpa_type', { length: 16 }),
    appliedCpaValue: numeric('applied_cpa_value', { precision: 12, scale: 4 }),
    specificityScore: integer('specificity_score'),
    winReason: text('win_reason'),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('orders_order_date_idx').on(table.orderDate),
    index('orders_affiliate_idx').on(table.affiliateCode),
    index('orders_sub_affiliate_idx').on(table.subAffiliateCode),
    index('orders_product_price_idx').on(table.product1Name, table.pricePoint),
    index('orders_commission_status_idx').on(table.commissionStatus),
    index('orders_report_idx').on(
      table.orderDate,
      table.affiliateCode,
      table.subAffiliateCode,
      table.product1Name,
      table.pricePoint,
    ),
  ],
);

/**
 * One audit header per order commission resolution.
 * Powers the audit screen without re-running the engine.
 */
export const orderCommissionAudits = pgTable(
  'order_commission_audits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderUuid: uuid('order_uuid')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' })
      .unique(),
    orderId: varchar('order_id', { length: 32 }).notNull(),
    winningRuleUuid: uuid('winning_rule_uuid').references(() => cpaRules.id),
    winningRuleId: varchar('winning_rule_id', { length: 32 }),
    winningSpecificity: integer('winning_specificity'),
    candidateCount: integer('candidate_count').notNull().default(0),
    commission: numeric('commission', { precision: 12, scale: 2 }),
    summary: text('summary'),
    calculatedAt: timestamp('calculated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('order_commission_audits_order_id_idx').on(table.orderId),
    index('order_commission_audits_rule_idx').on(table.winningRuleId),
  ],
);

/**
 * Every rule considered for an order, with match/win/lose reason.
 */
export const orderRuleEvaluations = pgTable(
  'order_rule_evaluations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    auditId: uuid('audit_id')
      .notNull()
      .references(() => orderCommissionAudits.id, { onDelete: 'cascade' }),
    orderUuid: uuid('order_uuid')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    ruleUuid: uuid('rule_uuid').references(() => cpaRules.id),
    ruleId: varchar('rule_id', { length: 32 }).notNull(),
    matched: boolean('matched').notNull().default(false),
    isWinner: boolean('is_winner').notNull().default(false),
    specificityScore: integer('specificity_score').notNull().default(0),
    /** date_out_of_range | scope_mismatch | lower_specificity | tie_lost | winner | ... */
    outcomeCode: varchar('outcome_code', { length: 64 }).notNull(),
    outcomeDetail: text('outcome_detail'),
    cpaType: varchar('cpa_type', { length: 16 }),
    cpaValue: numeric('cpa_value', { precision: 12, scale: 4 }),
    hypotheticalCommission: numeric('hypothetical_commission', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('order_rule_evaluations_audit_idx').on(table.auditId),
    index('order_rule_evaluations_order_idx').on(table.orderUuid),
    index('order_rule_evaluations_rule_idx').on(table.ruleId),
  ],
);

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type OrderCommissionAudit = typeof orderCommissionAudits.$inferSelect;
export type OrderRuleEvaluation = typeof orderRuleEvaluations.$inferSelect;
