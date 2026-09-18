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

export const auditApi = {
  byOrderId: (orderId: string) => api.get<AuditResponse>(`/audit/orders/${encodeURIComponent(orderId)}`),
};
