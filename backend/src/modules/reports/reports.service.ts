import { and, asc, eq, gte, lte, sql as dsql } from 'drizzle-orm';
import { cache, cached } from '../../cache/index.js';
import { db } from '../../db/client.js';
import {
  dailyPerformanceStats,
  affiliates,
  products,
  productPricePoints,
  subAffiliates,
} from '../../db/schema/index.js';
import { AppError } from '../../errors/AppError.js';

export type RoasMode = 'frontend' | 'total';

export type PerformanceFilters = {
  dateFrom: string;
  dateTo: string;
  affiliate?: string;
  subAffiliate?: string;
  product?: string;
  pricePoint?: string;
  roasMode: RoasMode;
};

export type MetricBlock = {
  revenue: number;
  spend: number;
  roas: number | null;
  sales: number;
  aov: number | null;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function metrics(revenue: number, spend: number, sales: number): MetricBlock {
  return {
    revenue: round2(revenue),
    spend: round2(spend),
    sales,
    roas: spend > 0 ? round2(revenue / spend) : null,
    aov: sales > 0 ? round2(revenue / sales) : null,
  };
}

function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function cacheKey(filters: PerformanceFilters) {
  return `report:perf:${filters.dateFrom}:${filters.dateTo}:${filters.affiliate ?? ''}:${filters.subAffiliate ?? ''}:${filters.product ?? ''}:${filters.pricePoint ?? ''}:${filters.roasMode}`;
}

type AggCell = { sales: number; revenue: number; spend: number };

type SubAgg = {
  sales: number;
  revenue: number;
  spend: number;
  byDay: Map<string, AggCell>;
};

type AffAgg = {
  sales: number;
  revenue: number;
  spend: number;
  byDay: Map<string, AggCell>;
  subs: Map<string, SubAgg>;
};

function bump(cell: AggCell | undefined, sales: number, revenue: number, spend: number): AggCell {
  const next = cell ?? { sales: 0, revenue: 0, spend: 0 };
  next.sales += sales;
  next.revenue += revenue;
  next.spend += spend;
  return next;
}

export class ReportsService {
  async getFilterOptions() {
    const { data } = await cached(
      'report:filter-options',
      async () => {
        const [affRows, subRows, productRows, priceRows, rangeRows] = await Promise.all([
          db.select({ code: affiliates.code }).from(affiliates).orderBy(asc(affiliates.code)),
          db
            .select({
              code: subAffiliates.code,
              affiliateCode: subAffiliates.affiliateCode,
            })
            .from(subAffiliates)
            .orderBy(asc(subAffiliates.code)),
          db
            .select({ name: products.name })
            .from(products)
            .where(eq(products.productKind, 'frontend'))
            .orderBy(asc(products.name)),
          db
            .select({
              productName: productPricePoints.productName,
              pricePoint: productPricePoints.pricePoint,
            })
            .from(productPricePoints)
            .orderBy(asc(productPricePoints.productName), asc(productPricePoints.pricePoint)),
          db
            .select({
              min: dsql<string>`MIN(${dailyPerformanceStats.statDate})::text`,
              max: dsql<string>`MAX(${dailyPerformanceStats.statDate})::text`,
            })
            .from(dailyPerformanceStats),
        ]);

        return {
          affiliates: affRows.map((r) => r.code),
          subAffiliates: subRows.map((r) => ({
            code: r.code,
            affiliateCode: r.affiliateCode,
          })),
          products: productRows.map((r) => r.name),
          pricePoints: priceRows.map((r) => ({
            productName: r.productName,
            pricePoint: String(r.pricePoint),
          })),
          dateMin: rangeRows[0]?.min ?? null,
          dateMax: rangeRows[0]?.max ?? null,
        };
      },
      120,
    );

    return data;
  }

  async getPerformance(filters: PerformanceFilters) {
    if (!filters.dateFrom || !filters.dateTo) {
      throw AppError.badRequest('dateFrom and dateTo are required');
    }
    if (filters.dateFrom > filters.dateTo) {
      throw AppError.badRequest('dateFrom must be on or before dateTo');
    }

    const key = cacheKey(filters);
    const started = Date.now();
    const { data, fromCache } = await cached(key, async () => this.buildPerformance(filters), 300);

    return {
      ...data,
      meta: {
        fromCache,
        tookMs: Date.now() - started,
        roasMode: filters.roasMode,
      },
    };
  }

  private async buildPerformance(filters: PerformanceFilters) {
    const conditions = [
      gte(dailyPerformanceStats.statDate, filters.dateFrom),
      lte(dailyPerformanceStats.statDate, filters.dateTo),
    ];

    if (filters.affiliate) {
      conditions.push(eq(dailyPerformanceStats.affiliateCode, filters.affiliate));
    }
    if (filters.subAffiliate) {
      conditions.push(eq(dailyPerformanceStats.subAffiliateCode, filters.subAffiliate));
    }
    if (filters.product) {
      conditions.push(eq(dailyPerformanceStats.productName, filters.product));
    }
    if (filters.pricePoint) {
      conditions.push(eq(dailyPerformanceStats.pricePoint, filters.pricePoint));
    }

    const useTotal = filters.roasMode === 'total';
    const revenueExpr = useTotal
      ? dsql<string>`COALESCE(SUM(${dailyPerformanceStats.totalRevenue}), 0)`
      : dsql<string>`COALESCE(SUM(${dailyPerformanceStats.frontendRevenue}), 0)`;

    const rows = await db
      .select({
        day: dailyPerformanceStats.statDate,
        affiliateCode: dailyPerformanceStats.affiliateCode,
        subAffiliateCode: dailyPerformanceStats.subAffiliateCode,
        sales: dsql<number>`COALESCE(SUM(${dailyPerformanceStats.salesCount}), 0)::int`,
        revenue: revenueExpr,
        spend: dsql<string>`COALESCE(SUM(${dailyPerformanceStats.spend}), 0)`,
      })
      .from(dailyPerformanceStats)
      .where(and(...conditions))
      .groupBy(
        dailyPerformanceStats.statDate,
        dailyPerformanceStats.affiliateCode,
        dailyPerformanceStats.subAffiliateCode,
      );

    const days = eachDay(filters.dateFrom, filters.dateTo);
    const affiliatesMap = new Map<string, AffAgg>();

    for (const row of rows) {
      const aff = row.affiliateCode || '(direct)';
      const sub = row.subAffiliateCode || '(none)';
      const day = String(row.day);
      const revenue = Number(row.revenue);
      const spend = Number(row.spend);
      const sales = Number(row.sales);

      if (!affiliatesMap.has(aff)) {
        affiliatesMap.set(aff, {
          sales: 0,
          revenue: 0,
          spend: 0,
          byDay: new Map(),
          subs: new Map(),
        });
      }
      const affAgg = affiliatesMap.get(aff)!;
      affAgg.sales += sales;
      affAgg.revenue += revenue;
      affAgg.spend += spend;
      affAgg.byDay.set(day, bump(affAgg.byDay.get(day), sales, revenue, spend));

      if (!affAgg.subs.has(sub)) {
        affAgg.subs.set(sub, {
          sales: 0,
          revenue: 0,
          spend: 0,
          byDay: new Map(),
        });
      }
      const subAgg = affAgg.subs.get(sub)!;
      subAgg.sales += sales;
      subAgg.revenue += revenue;
      subAgg.spend += spend;
      subAgg.byDay.set(day, bump(subAgg.byDay.get(day), sales, revenue, spend));
    }

    const serializeDayMap = (map: Map<string, AggCell>) => {
      const out: Record<string, MetricBlock> = {};
      for (const [day, cell] of map) {
        if (cell.sales === 0 && cell.revenue === 0 && cell.spend === 0) continue;
        out[day] = metrics(cell.revenue, cell.spend, cell.sales);
      }
      return out;
    };

    let totalSales = 0;
    let totalRevenue = 0;
    let totalSpend = 0;

    const reportRows = [...affiliatesMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([affiliateCode, agg]) => {
        totalSales += agg.sales;
        totalRevenue += agg.revenue;
        totalSpend += agg.spend;

        return {
          affiliateCode,
          level: 'affiliate' as const,
          totals: metrics(agg.revenue, agg.spend, agg.sales),
          byDay: serializeDayMap(agg.byDay),
          children: [...agg.subs.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([subAffiliateCode, sub]) => ({
              affiliateCode,
              subAffiliateCode,
              level: 'sub' as const,
              totals: metrics(sub.revenue, sub.spend, sub.sales),
              byDay: serializeDayMap(sub.byDay),
            })),
        };
      });

    return {
      days,
      rows: reportRows,
      totals: metrics(totalRevenue, totalSpend, totalSales),
      filters,
    };
  }

  async invalidateReportCache() {
    await cache.delByPrefix('report:');
  }

  /** Warm the default full-range report so the first UI hit is instant. */
  async warmDefaultCaches() {
    const options = await this.getFilterOptions();
    if (!options.dateMin || !options.dateMax) return;

    await Promise.all([
      this.getPerformance({
        dateFrom: options.dateMin,
        dateTo: options.dateMax,
        roasMode: 'frontend',
      }),
      this.getPerformance({
        dateFrom: options.dateMin,
        dateTo: options.dateMax,
        roasMode: 'total',
      }),
    ]);
  }
}

export const reportsService = new ReportsService();
