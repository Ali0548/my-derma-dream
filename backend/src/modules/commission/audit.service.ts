import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cpaRules, orders } from '../../db/schema/index.js';
import { AppError } from '../../errors/AppError.js';
import { commissionService } from './commission.service.js';

export class AuditService {
  async byOrderId(orderId: string) {
    const { order, resolution } = await commissionService.resolveOrderByOrderId(orderId);
    return {
      order: {
        orderId: order.orderId,
        orderDate: String(order.orderDate),
        affiliateCode: order.affiliateCode,
        subAffiliateCode: order.subAffiliateCode,
        product1Name: order.product1Name,
        product1Price: order.product1Price,
        pricePoint: order.pricePoint,
        frontendRevenue: order.frontendRevenue,
        upsellRevenue: order.upsellRevenue,
        totalRevenue: order.totalRevenue,
        storedCommission: order.commission,
        storedRuleId: order.appliedRuleId,
        winReason: order.winReason,
      },
      resolution,
    };
  }

  /**
   * Distinct CPA rules that paid this affiliate in the range.
   * Performance “eye” shows these rules + why — not a raw order dump.
   */
  async listPartnerRules(input: {
    affiliateCode: string;
    dateFrom: string;
    dateTo: string;
  }) {
    const affiliateCode = input.affiliateCode.trim();
    if (!affiliateCode || affiliateCode === '(direct)') {
      throw AppError.badRequest('A real affiliate code is required');
    }
    if (!input.dateFrom || !input.dateTo) {
      throw AppError.badRequest('dateFrom and dateTo are required');
    }

    const aggregates = await db
      .select({
        appliedRuleId: orders.appliedRuleId,
        orderCount: sql<number>`COUNT(*)::int`,
        totalPaid: sql<string>`COALESCE(SUM(${orders.commission}), 0)`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.affiliateCode, affiliateCode),
          gte(orders.orderDate, input.dateFrom),
          lte(orders.orderDate, input.dateTo),
        ),
      )
      .groupBy(orders.appliedRuleId)
      .orderBy(desc(sql`COUNT(*)`));

    const samples = await Promise.all(
      aggregates.map(async (row) => {
        const cond = [
          eq(orders.affiliateCode, affiliateCode),
          gte(orders.orderDate, input.dateFrom),
          lte(orders.orderDate, input.dateTo),
        ];
        if (row.appliedRuleId) {
          cond.push(eq(orders.appliedRuleId, row.appliedRuleId));
        } else {
          cond.push(sql`${orders.appliedRuleId} IS NULL`);
        }
        const [sample] = await db
          .select({
            orderId: orders.orderId,
            winReason: orders.winReason,
          })
          .from(orders)
          .where(and(...cond))
          .orderBy(desc(orders.orderDate), asc(orders.orderId))
          .limit(1);
        return {
          ruleId: row.appliedRuleId,
          orderCount: Number(row.orderCount),
          totalPaid: Number(row.totalPaid),
          sampleOrderId: sample?.orderId ?? null,
          winReason: sample?.winReason ?? null,
        };
      }),
    );

    const ruleIds = samples.map((s) => s.ruleId).filter((id): id is string => Boolean(id));
    const ruleMeta =
      ruleIds.length === 0
        ? []
        : await db
            .select({
              ruleId: cpaRules.ruleId,
              product: cpaRules.product,
              pricePoint: cpaRules.pricePoint,
              affiliate: cpaRules.affiliate,
              subAffiliate: cpaRules.subAffiliate,
              cpaType: cpaRules.cpaType,
              cpaValue: cpaRules.cpaValue,
              effectiveFrom: cpaRules.effectiveFrom,
              effectiveTo: cpaRules.effectiveTo,
              specificityScore: cpaRules.specificityScore,
            })
            .from(cpaRules)
            .where(inArray(cpaRules.ruleId, ruleIds));

    const metaById = new Map(ruleMeta.map((r) => [r.ruleId, r]));

    return {
      affiliateCode,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      rules: samples.map((s) => {
        const meta = s.ruleId ? metaById.get(s.ruleId) : undefined;
        return {
          ruleId: s.ruleId,
          orderCount: s.orderCount,
          totalPaid: s.totalPaid,
          sampleOrderId: s.sampleOrderId,
          winReason: s.winReason,
          product: meta?.product || null,
          pricePoint: meta?.pricePoint || null,
          affiliate: meta?.affiliate || null,
          subAffiliate: meta?.subAffiliate || null,
          cpaType: (meta?.cpaType as 'fixed' | 'percent' | null) ?? null,
          cpaValue: meta?.cpaValue != null ? Number(meta.cpaValue) : null,
          effectiveFrom: meta?.effectiveFrom ? String(meta.effectiveFrom) : null,
          effectiveTo: meta?.effectiveTo ? String(meta.effectiveTo) : null,
          specificityScore: meta?.specificityScore ?? null,
        };
      }),
    };
  }

  /**
   * Primary winning rule per affiliate (and sub) for the Performance partner column.
   */
  async winningRulesSummary(input: { dateFrom: string; dateTo: string }) {
    if (!input.dateFrom || !input.dateTo) {
      throw AppError.badRequest('dateFrom and dateTo are required');
    }

    const rows = await db
      .select({
        affiliateCode: orders.affiliateCode,
        subAffiliateCode: orders.subAffiliateCode,
        appliedRuleId: orders.appliedRuleId,
        orderCount: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(
        and(
          gte(orders.orderDate, input.dateFrom),
          lte(orders.orderDate, input.dateTo),
          sql`${orders.appliedRuleId} IS NOT NULL`,
        ),
      )
      .groupBy(orders.affiliateCode, orders.subAffiliateCode, orders.appliedRuleId);

    type Bucket = {
      ruleId: string;
      orderCount: number;
      ruleCount: number;
      allRules: Map<string, number>;
    };

    const byAffiliate = new Map<string, Bucket>();
    const bySub = new Map<string, Bucket>();

    const bump = (map: Map<string, Bucket>, key: string, ruleId: string, count: number) => {
      let bucket = map.get(key);
      if (!bucket) {
        bucket = { ruleId, orderCount: count, ruleCount: 1, allRules: new Map([[ruleId, count]]) };
        map.set(key, bucket);
        return;
      }
      bucket.allRules.set(ruleId, (bucket.allRules.get(ruleId) ?? 0) + count);
      let bestId = ruleId;
      let bestCount = -1;
      for (const [id, n] of bucket.allRules) {
        if (n > bestCount || (n === bestCount && id < bestId)) {
          bestId = id;
          bestCount = n;
        }
      }
      bucket.ruleId = bestId;
      bucket.orderCount = bestCount;
      bucket.ruleCount = bucket.allRules.size;
    };

    for (const row of rows) {
      const aff = row.affiliateCode || '(direct)';
      const ruleId = row.appliedRuleId!;
      const count = Number(row.orderCount);
      bump(byAffiliate, aff, ruleId, count);
      if (row.subAffiliateCode) {
        bump(bySub, `${aff}::${row.subAffiliateCode}`, ruleId, count);
      }
    }

    const toRow = (code: string, bucket: Bucket) => ({
      code,
      primaryRuleId: bucket.ruleId,
      primaryOrderCount: bucket.orderCount,
      distinctRuleCount: bucket.ruleCount,
    });

    return {
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      affiliates: [...byAffiliate.entries()]
        .map(([code, b]) => toRow(code, b))
        .sort((a, b) => a.code.localeCompare(b.code)),
      subs: [...bySub.entries()].map(([key, b]) => {
        const [affiliateCode, subAffiliateCode] = key.split('::');
        return {
          affiliateCode,
          subAffiliateCode,
          primaryRuleId: b.ruleId,
          primaryOrderCount: b.orderCount,
          distinctRuleCount: b.ruleCount,
        };
      }),
    };
  }

  async listPartnerOrders(input: {
    affiliateCode: string;
    dateFrom: string;
    dateTo: string;
    limit?: number;
  }) {
    const affiliateCode = input.affiliateCode.trim();
    if (!affiliateCode || affiliateCode === '(direct)') {
      throw AppError.badRequest('A real affiliate code is required');
    }
    if (!input.dateFrom || !input.dateTo) {
      throw AppError.badRequest('dateFrom and dateTo are required');
    }

    const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
    const rows = await db
      .select({
        orderId: orders.orderId,
        orderDate: orders.orderDate,
        affiliateCode: orders.affiliateCode,
        subAffiliateCode: orders.subAffiliateCode,
        product1Name: orders.product1Name,
        pricePoint: orders.pricePoint,
        frontendRevenue: orders.frontendRevenue,
        totalRevenue: orders.totalRevenue,
        commission: orders.commission,
        appliedRuleId: orders.appliedRuleId,
        winReason: orders.winReason,
      })
      .from(orders)
      .where(
        and(
          eq(orders.affiliateCode, affiliateCode),
          gte(orders.orderDate, input.dateFrom),
          lte(orders.orderDate, input.dateTo),
        ),
      )
      .orderBy(desc(orders.orderDate), asc(orders.orderId))
      .limit(limit);

    return {
      affiliateCode,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      orders: rows.map((r) => ({
        orderId: r.orderId,
        orderDate: String(r.orderDate),
        affiliateCode: r.affiliateCode,
        subAffiliateCode: r.subAffiliateCode,
        product1Name: r.product1Name,
        pricePoint: r.pricePoint,
        frontendRevenue: Number(r.frontendRevenue),
        totalRevenue: Number(r.totalRevenue),
        commission: Number(r.commission ?? 0),
        appliedRuleId: r.appliedRuleId,
        winReason: r.winReason,
      })),
    };
  }
}

export const auditService = new AuditService();
