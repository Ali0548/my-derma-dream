import { api } from './client';

export type RoasMode = 'frontend' | 'total';

export type MetricBlock = {
  revenue: number;
  spend: number;
  roas: number | null;
  sales: number;
  aov: number | null;
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
  filters: {
    dateFrom: string;
    dateTo: string;
    affiliate?: string;
    subAffiliate?: string;
    product?: string;
    pricePoint?: string;
    roasMode: RoasMode;
  };
  meta: {
    fromCache: boolean;
    tookMs: number;
    roasMode: RoasMode;
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
  roasMode: RoasMode;
};

export const reportsApi = {
  filters: () => api.get<FilterOptions>('/reports/filters'),
  performance: (params: PerformanceQuery) =>
    api.get<PerformanceReport>('/reports/performance', { params }),
};
