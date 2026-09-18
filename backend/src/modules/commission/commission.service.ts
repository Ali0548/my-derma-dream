import { asc, eq, sql as dsql } from 'drizzle-orm';
import { db, pgClient } from '../../db/client.js';
import { cache } from '../../cache/index.js';
import { cpaRules, orders, dailyPerformanceStats } from '../../db/schema/index.js';
import {
  resolveCommission,
  resolveCommissionFast,
  type OrderInput,
  type RuleInput,
  type ResolutionResult,
} from './engine.js';

const BATCH = 2500;

function toRuleInput(row: typeof cpaRules.$inferSelect): RuleInput {
  return {
    id: row.id,
    ruleId: row.ruleId,
    product: row.product ?? '',
    pricePoint: row.pricePoint ?? '',
    affiliate: row.affiliate ?? '',
    subAffiliate: row.subAffiliate ?? '',
    cpaType: row.cpaType as 'fixed' | 'percent',
    cpaValue: Number(row.cpaValue),
    effectiveFrom: String(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? String(row.effectiveTo) : null,
  };
}

function toOrderInput(row: typeof orders.$inferSelect): OrderInput {
  return {
    id: row.id,
    orderId: row.orderId,
    orderDate: String(row.orderDate),
    affiliateCode: row.affiliateCode ?? '',
    subAffiliateCode: row.subAffiliateCode ?? '',
    product1Name: row.product1Name,
    pricePoint: row.pricePoint ?? '',
    frontendRevenue: Number(row.frontendRevenue ?? row.product1Price),
  };
}

export class CommissionService {
  async loadActiveRules(): Promise<RuleInput[]> {
    const rows = await db.select().from(cpaRules).where(eq(cpaRules.isActive, true));
    return rows.map(toRuleInput);
  }

  /**
   * Bulk path: stamp each order with winning rule + commission, then rebuild rollups.
   * Full candidate explanations are computed on demand in the audit API.
   */
  async recalculateAll(onProgress?: (done: number, total: number) => void) {
    const rules = await this.loadActiveRules();
    const [{ count }] = await db.select({ count: dsql<number>`count(*)::int` }).from(orders);
    const total = Number(count);
    let done = 0;
    let offset = 0;

    while (offset < total) {
      const batch = await db
        .select({
          id: orders.id,
          orderId: orders.orderId,
          orderDate: orders.orderDate,
          affiliateCode: orders.affiliateCode,
          subAffiliateCode: orders.subAffiliateCode,
          product1Name: orders.product1Name,
          product1Price: orders.product1Price,
          pricePoint: orders.pricePoint,
          frontendRevenue: orders.frontendRevenue,
        })
        .from(orders)
        .orderBy(asc(orders.orderId))
        .limit(BATCH)
        .offset(offset);

      if (batch.length === 0) break;

      const ids: string[] = [];
      const commissions: string[] = [];
      const statuses: string[] = [];
      const ruleIds: (string | null)[] = [];
      const ruleUuids: (string | null)[] = [];
      const cpaTypes: (string | null)[] = [];
      const cpaValues: (string | null)[] = [];
      const scores: (number | null)[] = [];
      const reasons: (string | null)[] = [];

      for (const row of batch) {
        const result = resolveCommissionFast(
          {
            id: row.id,
            orderId: row.orderId,
            orderDate: String(row.orderDate),
            affiliateCode: row.affiliateCode ?? '',
            subAffiliateCode: row.subAffiliateCode ?? '',
            product1Name: row.product1Name,
            pricePoint: row.pricePoint ?? '',
            frontendRevenue: Number(row.frontendRevenue ?? row.product1Price),
          },
          rules,
        );
        const winner = result.winningRule;

        ids.push(row.id);
        commissions.push(result.commission.toFixed(2));
        statuses.push(result.status === 'resolved' ? 'resolved' : 'no_rule');
        ruleIds.push(winner?.ruleId ?? null);
        ruleUuids.push(winner?.id ?? null);
        cpaTypes.push(winner?.cpaType ?? null);
        cpaValues.push(winner ? winner.cpaValue.toFixed(4) : null);
        scores.push(result.specificityScore);
        reasons.push(result.winReason);
      }

      const ruleIdVals = ruleIds.map((v) => v ?? '');
      const ruleUuidVals = ruleUuids.map((v) => v ?? '');
      const cpaTypeVals = cpaTypes.map((v) => v ?? '');
      const cpaValueVals = cpaValues.map((v) => v ?? '');
      const scoreVals = scores.map((v) => (v == null ? -1 : v));
      const reasonVals = reasons.map((v) => v ?? '');

      await pgClient`
        UPDATE orders AS o SET
          commission = v.commission::numeric(12,2),
          commission_status = v.status,
          applied_rule_id = NULLIF(v.rule_id, ''),
          applied_rule_uuid = NULLIF(v.rule_uuid, '')::uuid,
          applied_cpa_type = NULLIF(v.cpa_type, ''),
          applied_cpa_value = NULLIF(v.cpa_value, '')::numeric(12,4),
          specificity_score = NULLIF(v.score, -1),
          win_reason = NULLIF(v.reason, ''),
          calculated_at = NOW(),
          updated_at = NOW()
        FROM (
          SELECT *
          FROM UNNEST(
            ${ids}::uuid[],
            ${commissions}::text[],
            ${statuses}::text[],
            ${ruleIdVals}::text[],
            ${ruleUuidVals}::text[],
            ${cpaTypeVals}::text[],
            ${cpaValueVals}::text[],
            ${scoreVals}::int[],
            ${reasonVals}::text[]
          ) AS t(id, commission, status, rule_id, rule_uuid, cpa_type, cpa_value, score, reason)
        ) AS v
        WHERE o.id = v.id
      `;

      done += batch.length;
      offset += batch.length;
      onProgress?.(done, total);
    }

    await this.rebuildDailyStats();
    await cache.delByPrefix('report:');
    return { processed: done, total, rulesLoaded: rules.length };
  }

  async resolveOrderByOrderId(orderId: string): Promise<{
    order: typeof orders.$inferSelect;
    resolution: ResolutionResult;
  }> {
    const [row] = await db.select().from(orders).where(eq(orders.orderId, orderId)).limit(1);
    if (!row) {
      throw new Error(`Order not found: ${orderId}`);
    }
    const rules = await this.loadActiveRules();
    return { order: row, resolution: resolveCommission(toOrderInput(row), rules) };
  }

  async rebuildDailyStats() {
    await db.delete(dailyPerformanceStats);
    await db.execute(dsql`
      INSERT INTO daily_performance_stats (
        stat_date,
        affiliate_code,
        sub_affiliate_code,
        product_name,
        price_point,
        sales_count,
        frontend_revenue,
        upsell_revenue,
        total_revenue,
        spend,
        updated_at
      )
      SELECT
        order_date,
        affiliate_code,
        sub_affiliate_code,
        product_1_name,
        price_point,
        COUNT(*)::int,
        COALESCE(SUM(frontend_revenue), 0),
        COALESCE(SUM(upsell_revenue), 0),
        COALESCE(SUM(total_revenue), 0),
        COALESCE(SUM(commission), 0),
        NOW()
      FROM orders
      GROUP BY order_date, affiliate_code, sub_affiliate_code, product_1_name, price_point
    `);
  }
}

export const commissionService = new CommissionService();
