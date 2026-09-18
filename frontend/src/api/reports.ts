import { api } from './client';
export { deriveReportView } from './deriveReport';

export type RoasMode = 'frontend' | 'total';

export type MetricBlock = {
  revenue: number;
  spend: number;
  roas: number | null;
  sales: number;
  aov: number | null;
};

/** [sales, frontendRevenue, totalRevenue, spend] */
export type CompactCell = [number, number, number, number];

export type CompactChild = {
  s: string;
  t: CompactCell;
  d: Record<string, CompactCell>;
};

export type CompactAffiliate = {
  a: string;
  t: CompactCell;
  d: Record<string, CompactCell>;
  c: CompactChild[];
};

export type CompactReport = {
  days: string[];
  rows: CompactAffiliate[];
  totals: CompactCell;
  range?: { dateFrom: string; dateTo: string };
  meta?: {
    fromCache: boolean;
    tookMs: number;
  };
};

export type PerformanceChildRow = {
  affiliateCode: string;
  subAffiliateCode: string;
  level: 'sub';
  totals: MetricBlock;
  byDay: Record<string, MetricBlock>;
};

export type PerformanceAffiliateRow = {
  affiliateCode: string;
  level: 'affiliate';
  totals: MetricBlock;
  byDay: Record<string, MetricBlock>;
  children: PerformanceChildRow[];
};

export type PerformanceReport = {
  days: string[];
  rows: PerformanceAffiliateRow[];
  totals: MetricBlock;
  meta: {
    fromCache: boolean;
    tookMs: number;
    roasMode: RoasMode;
    derivedClientSide: boolean;
  };
};

export type FilterOptions = {
  affiliates: string[];
  subAffiliates: { code: string; affiliateCode: string }[];
  products: string[];
  pricePoints: { productName: string; pricePoint: string }[];
  dateMin: string | null;
  dateMax: string | null;
};

export type PerformanceQuery = {
  dateFrom: string;
  dateTo: string;
  affiliate?: string;
  subAffiliate?: string;
  product?: string;
  pricePoint?: string;
  roasMode?: RoasMode;
};

export const reportsApi = {
  filters: () => api.get<FilterOptions>('/reports/filters'),
  performanceBase: async (params: {
    dateFrom: string;
    dateTo: string;
    product?: string;
    pricePoint?: string;
  }) => {
    const res = await api.get<CompactReport>('/reports/performance', { params });
    return res;
  },
};
