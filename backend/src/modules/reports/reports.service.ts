import { and, asc, eq, gte, lte, sql as dsql } from 'drizzle-orm';
import { REPORT_CACHE_TTL_SECONDS, cache, cached } from '../../cache/index.js';
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
  /** Kept for API compat; payload always includes both revenues. */
  roasMode?: RoasMode;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** One cache entry per date/filter slice — ROAS is chosen on the client. */
function cacheKey(filters: PerformanceFilters) {
  return `report:perf:v4:${filters.dateFrom}:${filters.dateTo}:${filters.affiliate ?? ''}:${filters.subAffiliate ?? ''}:${filters.product ?? ''}:${filters.pricePoint ?? ''}`;
}

type AggCell = { sales: number; frontend: number; total: number; spend: number };

type SubAgg = {
  sales: number;
  frontend: number;
  total: number;
  spend: number;
  byDay: Map<string, AggCell>;
};

type AffAgg = {
  sales: number;
  frontend: number;
  total: number;
  spend: number;
  byDay: Map<string, AggCell>;
  subs: Map<string, SubAgg>;
};

function bump(
  cell: AggCell | undefined,
  sales: number,
  frontend: number,
  total: number,
  spend: number,
): AggCell {
  const next = cell ?? { sales: 0, frontend: 0, total: 0, spend: 0 };
  next.sales += sales;
  next.frontend += frontend;
  next.total += total;
  next.spend += spend;
  return next;
}

/** Wire cell: [sales, frontendRevenue, totalRevenue, spend] */
function pack(sales: number, frontend: number, total: number, spend: number): [number, number, number, number] {
  return [sales, round2(frontend), round2(total), round2(spend)];
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
      24 * 60 * 60,
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
    const { data, fromCache } = await cached(
      key,
      async () => this.buildPerformance(filters),
      REPORT_CACHE_TTL_SECONDS,
    );

    return {
      ...data,
      meta: {
        fromCache,
        tookMs: Date.now() - started,
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

    const rows = await db
      .select({
        day: dailyPerformanceStats.statDate,
        affiliateCode: dailyPerformanceStats.affiliateCode,
        subAffiliateCode: dailyPerformanceStats.subAffiliateCode,
        sales: dsql<number>`COALESCE(SUM(${dailyPerformanceStats.salesCount}), 0)::int`,
        frontend: dsql<string>`COALESCE(SUM(${dailyPerformanceStats.frontendRevenue}), 0)`,
        total: dsql<string>`COALESCE(SUM(${dailyPerformanceStats.totalRevenue}), 0)`,
        spend: dsql<string>`COALESCE(SUM(${dailyPerformanceStats.spend}), 0)`,
      })
      .from(dailyPerformanceStats)
      .where(and(...conditions))
      .groupBy(
        dailyPerformanceStats.statDate,
        dailyPerformanceStats.affiliateCode,
        dailyPerformanceStats.subAffiliateCode,
      );

    const daysWithActivity = new Set<string>();
    for (const row of rows) {
      daysWithActivity.add(String(row.day));
    }
    const days = [...daysWithActivity].sort();

    const affiliatesMap = new Map<string, AffAgg>();

    for (const row of rows) {
      const aff = row.affiliateCode || '(direct)';
      const sub = row.subAffiliateCode || '(none)';
      const day = String(row.day);
      const frontend = Number(row.frontend);
      const total = Number(row.total);
      const spend = Number(row.spend);
      const sales = Number(row.sales);

      if (!affiliatesMap.has(aff)) {
        affiliatesMap.set(aff, {
          sales: 0,
          frontend: 0,
          total: 0,
          spend: 0,
          byDay: new Map(),
          subs: new Map(),
        });
      }
      const affAgg = affiliatesMap.get(aff)!;
      affAgg.sales += sales;
      affAgg.frontend += frontend;
      affAgg.total += total;
      affAgg.spend += spend;
      affAgg.byDay.set(day, bump(affAgg.byDay.get(day), sales, frontend, total, spend));

      if (!affAgg.subs.has(sub)) {
        affAgg.subs.set(sub, {
          sales: 0,
          frontend: 0,
          total: 0,
          spend: 0,
          byDay: new Map(),
        });
      }
      const subAgg = affAgg.subs.get(sub)!;
      subAgg.sales += sales;
      subAgg.frontend += frontend;
      subAgg.total += total;
      subAgg.spend += spend;
      subAgg.byDay.set(day, bump(subAgg.byDay.get(day), sales, frontend, total, spend));
    }

    const serializeDayMap = (map: Map<string, AggCell>) => {
      const out: Record<string, [number, number, number, number]> = {};
      for (const [day, cell] of map) {
        if (cell.sales === 0 && cell.frontend === 0 && cell.total === 0 && cell.spend === 0) continue;
        out[day] = pack(cell.sales, cell.frontend, cell.total, cell.spend);
      }
      return out;
    };

    let totalSales = 0;
    let totalFrontend = 0;
    let totalRevenue = 0;
    let totalSpend = 0;

    const reportRows = [...affiliatesMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([affiliateCode, agg]) => {
        totalSales += agg.sales;
        totalFrontend += agg.frontend;
        totalRevenue += agg.total;
        totalSpend += agg.spend;

        return {
          a: affiliateCode,
          t: pack(agg.sales, agg.frontend, agg.total, agg.spend),
          d: serializeDayMap(agg.byDay),
          c: [...agg.subs.entries()]
            .sort((x, y) => x[0].localeCompare(y[0]))
            .map(([subAffiliateCode, sub]) => ({
              s: subAffiliateCode,
              t: pack(sub.sales, sub.frontend, sub.total, sub.spend),
              d: serializeDayMap(sub.byDay),
            })),
        };
      });

    return {
      days,
      rows: reportRows,
      totals: pack(totalSales, totalFrontend, totalRevenue, totalSpend),
      range: { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
    };
  }

  async invalidateReportCache() {
    await cache.delByPrefix('report:');
  }

  async warmDefaultCaches() {
    const options = await this.getFilterOptions();
    if (!options.dateMin || !options.dateMax) return;

    // One full-year payload (both revenues). Client slices ROAS / filters from this.
    await this.getPerformance({
      dateFrom: options.dateMin,
      dateTo: options.dateMax,
    });
  }
}

export const reportsService = new ReportsService();
