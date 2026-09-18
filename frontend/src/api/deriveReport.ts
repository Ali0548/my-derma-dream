import type {
  CompactAffiliate,
  CompactCell,
  CompactReport,
  MetricBlock,
  PerformanceAffiliateRow,
  PerformanceChildRow,
  PerformanceReport,
  RoasMode,
} from './reports';

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function metricsFrom(sales: number, revenue: number, spend: number): MetricBlock {
  return {
    sales,
    revenue: round2(revenue),
    spend: round2(spend),
    roas: spend > 0 ? round2(revenue / spend) : null,
    aov: sales > 0 ? round2(revenue / sales) : null,
  };
}

function pick(cell: CompactCell, roasMode: RoasMode) {
  const [sales, frontend, total, spend] = cell;
  return { sales, revenue: roasMode === 'total' ? total : frontend, spend };
}

function sliceEntity(
  byDay: Record<string, CompactCell>,
  dateFrom: string,
  dateTo: string,
  roasMode: RoasMode,
  activeDays: Set<string>,
) {
  let sales = 0;
  let revenue = 0;
  let spend = 0;
  const out: Record<string, MetricBlock> = {};
  for (const [day, cell] of Object.entries(byDay)) {
    if (day < dateFrom || day > dateTo) continue;
    const p = pick(cell, roasMode);
    if (p.sales === 0 && p.revenue === 0 && p.spend === 0) continue;
    sales += p.sales;
    revenue += p.revenue;
    spend += p.spend;
    out[day] = metricsFrom(p.sales, p.revenue, p.spend);
    activeDays.add(day);
  }
  return { sales, revenue, spend, byDay: out };
}

/**
 * Slice a cached full-year compact report on the client.
 * ROAS / date / partner changes must not hit the network.
 * Day columns are only days with activity in the filtered slice (keeps paint fast).
 */
export function deriveReportView(
  base: CompactReport,
  opts: {
    dateFrom: string;
    dateTo: string;
    affiliate?: string;
    subAffiliate?: string;
    roasMode: RoasMode;
  },
): PerformanceReport {
  const activeDays = new Set<string>();
  let source: CompactAffiliate[] = base.rows;
  if (opts.affiliate) {
    source = source.filter((r) => r.a === opts.affiliate);
  }

  const outRows: PerformanceAffiliateRow[] = [];
  let sales = 0;
  let revenue = 0;
  let spend = 0;

  for (const row of source) {
    const childSources = opts.subAffiliate
      ? row.c.filter((c) => c.s === opts.subAffiliate)
      : row.c;

    const children: PerformanceChildRow[] = [];
    for (const child of childSources) {
      const sliced = sliceEntity(
        child.d,
        opts.dateFrom,
        opts.dateTo,
        opts.roasMode,
        activeDays,
      );
      if (sliced.sales === 0 && sliced.revenue === 0 && sliced.spend === 0) continue;
      children.push({
        affiliateCode: row.a,
        subAffiliateCode: child.s,
        level: 'sub',
        totals: metricsFrom(sliced.sales, sliced.revenue, sliced.spend),
        byDay: sliced.byDay,
      });
    }

    let affSales = 0;
    let affRev = 0;
    let affSpend = 0;
    let affByDay: Record<string, MetricBlock> = {};

    if (opts.subAffiliate) {
      for (const child of children) {
        affSales += child.totals.sales;
        affRev += child.totals.revenue;
        affSpend += child.totals.spend;
        for (const [day, cell] of Object.entries(child.byDay)) {
          const prev = affByDay[day];
          if (!prev) {
            affByDay[day] = { ...cell };
          } else {
            affByDay[day] = metricsFrom(
              prev.sales + cell.sales,
              prev.revenue + cell.revenue,
              prev.spend + cell.spend,
            );
          }
        }
      }
    } else {
      const sliced = sliceEntity(row.d, opts.dateFrom, opts.dateTo, opts.roasMode, activeDays);
      affSales = sliced.sales;
      affRev = sliced.revenue;
      affSpend = sliced.spend;
      affByDay = sliced.byDay;
    }

    if (affSales === 0 && affRev === 0 && affSpend === 0) continue;

    sales += affSales;
    revenue += affRev;
    spend += affSpend;

    outRows.push({
      affiliateCode: row.a,
      level: 'affiliate',
      totals: metricsFrom(affSales, affRev, affSpend),
      byDay: affByDay,
      children,
    });
  }

  const days = [...activeDays].sort();

  return {
    days,
    rows: outRows,
    totals: metricsFrom(sales, revenue, spend),
    meta: {
      fromCache: Boolean(base.meta?.fromCache),
      tookMs: base.meta?.tookMs ?? 0,
      roasMode: opts.roasMode,
      derivedClientSide: true,
    },
  };
}
