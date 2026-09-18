import {
  pgTable,
  uuid,
  varchar,
  date,
  numeric,
  integer,
  timestamp,
  index,
  uniqueIndex,
  text,
  jsonb,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * Pre-aggregated report grain for sub-2s full-year queries.
 * Rebuild after import or rule changes that affect commissions.
 *
 * Metrics:
 * - frontend_revenue / total_revenue / spend (commission)
 * - sales count
 * ROAS and AOV are derived in the API (revenue/spend, revenue/sales).
 */
export const dailyPerformanceStats = pgTable(
  'daily_performance_stats',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    statDate: date('stat_date').notNull(),
    affiliateCode: varchar('affiliate_code', { length: 64 }).notNull().default(''),
    subAffiliateCode: varchar('sub_affiliate_code', { length: 64 }).notNull().default(''),
    productName: varchar('product_name', { length: 120 }).notNull().default(''),
    pricePoint: varchar('price_point', { length: 32 }).notNull().default(''),
    salesCount: integer('sales_count').notNull().default(0),
    frontendRevenue: numeric('frontend_revenue', { precision: 14, scale: 2 }).notNull().default('0'),
    upsellRevenue: numeric('upsell_revenue', { precision: 14, scale: 2 }).notNull().default('0'),
    totalRevenue: numeric('total_revenue', { precision: 14, scale: 2 }).notNull().default('0'),
    spend: numeric('spend', { precision: 14, scale: 2 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('daily_performance_stats_grain_uq').on(
      table.statDate,
      table.affiliateCode,
      table.subAffiliateCode,
      table.productName,
      table.pricePoint,
    ),
    index('daily_performance_stats_date_idx').on(table.statDate),
    index('daily_performance_stats_affiliate_idx').on(table.affiliateCode, table.subAffiliateCode),
    index('daily_performance_stats_product_idx').on(table.productName, table.pricePoint),
    index('daily_performance_stats_report_idx').on(
      table.statDate,
      table.affiliateCode,
      table.productName,
      table.pricePoint,
    ),
  ],
);

export const importKinds = ['orders', 'rules', 'full'] as const;
export const importStatuses = ['pending', 'running', 'completed', 'failed'] as const;

/**
 * Tracks CSV / seed import runs for ops and re-runs.
 */
export const dataImports = pgTable(
  'data_imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: varchar('kind', { length: 32 }).notNull(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    sourcePath: text('source_path'),
    rowCount: integer('row_count').default(0),
    successCount: integer('success_count').default(0),
    errorCount: integer('error_count').default(0),
    errorSample: jsonb('error_sample'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    triggeredBy: uuid('triggered_by').references(() => users.id),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('data_imports_kind_status_idx').on(table.kind, table.status),
    index('data_imports_created_idx').on(table.createdAt),
  ],
);

/**
 * Optional queue of commission recalculation after rule edits.
 */
export const recalcJobs = pgTable(
  'recalc_jobs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    status: varchar('status', { length: 32 }).notNull().default('pending'),
    reason: varchar('reason', { length: 64 }).notNull(),
    ruleId: varchar('rule_id', { length: 32 }),
    dateFrom: date('date_from'),
    dateTo: date('date_to'),
    ordersProcessed: integer('orders_processed').default(0),
    ordersTotal: integer('orders_total').default(0),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('recalc_jobs_status_idx').on(table.status),
    index('recalc_jobs_created_idx').on(table.createdAt),
  ],
);

export type DailyPerformanceStat = typeof dailyPerformanceStats.$inferSelect;
export type DataImport = typeof dataImports.$inferSelect;
export type RecalcJob = typeof recalcJobs.$inferSelect;
