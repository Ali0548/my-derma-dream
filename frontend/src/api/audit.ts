import { api } from './client';

export type RuleEvaluation = {
  ruleId: string;
  ruleUuid: string;
  matched: boolean;
  isWinner: boolean;
  specificityScore: number;
  outcomeCode: string;
  outcomeDetail: string;
  cpaType: 'fixed' | 'percent' | null;
  cpaValue: number | null;
  hypotheticalCommission: number | null;
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  scoreBreakdown: string;
};

export type AuditResponse = {
  order: {
    orderId: string;
    orderDate: string;
    affiliateCode: string;
    subAffiliateCode: string | null;
    product1Name: string;
    product1Price: string;
    pricePoint: string | null;
    frontendRevenue: string;
    upsellRevenue: string;
    totalRevenue: string;
    storedCommission: string | null;
    storedRuleId: string | null;
    winReason: string | null;
  };
  resolution: {
    status: 'resolved' | 'no_rule';
    commission: number;
    winningRule: {
      ruleId: string;
      product: string;
      pricePoint: string;
      affiliate: string;
      subAffiliate: string;
      cpaType: 'fixed' | 'percent';
      cpaValue: number;
      effectiveFrom: string;
      effectiveTo: string | null;
    } | null;
    specificityScore: number | null;
    winReason: string;
    evaluations: RuleEvaluation[];
  };
};

export type PartnerOrderRow = {
  orderId: string;
  orderDate: string;
  affiliateCode: string;
  subAffiliateCode: string | null;
  product1Name: string;
  pricePoint: string | null;
  frontendRevenue: number;
  totalRevenue: number;
  commission: number;
  appliedRuleId: string | null;
  winReason: string | null;
};

export type PartnerRuleRow = {
  ruleId: string | null;
  orderCount: number;
  totalPaid: number;
  sampleOrderId: string | null;
  winReason: string | null;
  product: string | null;
  pricePoint: string | null;
  affiliate: string | null;
  subAffiliate: string | null;
  cpaType: 'fixed' | 'percent' | null;
  cpaValue: number | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  specificityScore: number | null;
};

export type WinningRuleSummary = {
  dateFrom: string;
  dateTo: string;
  affiliates: {
    code: string;
    primaryRuleId: string;
    primaryOrderCount: number;
    distinctRuleCount: number;
  }[];
  subs: {
    affiliateCode: string;
    subAffiliateCode: string;
    primaryRuleId: string;
    primaryOrderCount: number;
    distinctRuleCount: number;
  }[];
};

export const auditApi = {
  byOrderId: (orderId: string) =>
    api.get<AuditResponse>(`/audit/orders/${encodeURIComponent(orderId)}`),
  partnerOrders: (affiliateCode: string, params: { dateFrom: string; dateTo: string; limit?: number }) =>
    api.get<{ affiliateCode: string; dateFrom: string; dateTo: string; orders: PartnerOrderRow[] }>(
      `/audit/partners/${encodeURIComponent(affiliateCode)}/orders`,
      { params },
    ),
  partnerRules: (affiliateCode: string, params: { dateFrom: string; dateTo: string }) =>
    api.get<{ affiliateCode: string; dateFrom: string; dateTo: string; rules: PartnerRuleRow[] }>(
      `/audit/partners/${encodeURIComponent(affiliateCode)}/rules`,
      { params },
    ),
  winningRulesSummary: (params: { dateFrom: string; dateTo: string }) =>
    api.get<WinningRuleSummary>('/audit/partners/winning-rules', { params }),
};
