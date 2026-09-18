import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  boolean,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const userRoles = ['admin', 'manager'] as const;
export type UserRole = (typeof userRoles)[number];

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  role: varchar('role', { length: 32 }).notNull().default('manager'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Partner directory for filters and searchable selects.
 * Populated from order/rule imports and kept in sync by the app.
 */
export const affiliates = pgTable('affiliates', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 160 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const subAffiliates = pgTable(
  'sub_affiliates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull(),
    affiliateCode: varchar('affiliate_code', { length: 64 }).notNull(),
    name: varchar('name', { length: 160 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('sub_affiliates_code_uq').on(table.code),
  ],
);

/**
 * Catalogue helpers for rule editor + report filters.
 * product_kind: frontend | upsell
 */
export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    productKind: varchar('product_kind', { length: 32 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('products_name_kind_uq').on(table.name, table.productKind)],
);

export const productPricePoints = pgTable(
  'product_price_points',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    productName: varchar('product_name', { length: 120 }).notNull(),
    /** Normalized display/match key, e.g. "49" (orders may store 49.00). */
    pricePoint: varchar('price_point', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('product_price_points_uq').on(table.productName, table.pricePoint),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Affiliate = typeof affiliates.$inferSelect;
export type SubAffiliate = typeof subAffiliates.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductPricePoint = typeof productPricePoints.$inferSelect;
