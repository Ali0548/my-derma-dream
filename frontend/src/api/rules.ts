import { api } from './client';

export type CpaType = 'fixed' | 'percent';

export type RuleRow = {
  id: string;
  ruleId: string;
  product: string | null;
  pricePoint: string | null;
  affiliate: string | null;
  subAffiliate: string | null;
  cpaType: CpaType;
  cpaValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  specificityScore: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RulePayload = {
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
  cpaType: CpaType;
  cpaValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes?: string | null;
  isActive?: boolean;
};

export type OverlapItem = {
  existingRuleId: string;
  existingRuleUuid: string;
  existingScope: string;
  existingCpaType: CpaType;
  existingCpaValue: number;
  existingEffectiveFrom: string;
  existingEffectiveTo: string | null;
  existingSpecificity: number;
  draftWouldWin: boolean;
  winnerRuleId: string;
  reason: string;
};

export type OverlapResult = {
  hasOverlap: boolean;
  overlapCount: number;
  draftWouldWinCount: number;
  draftWouldLoseCount: number;
  overlaps: OverlapItem[];
};

export type PreviewPayload = {
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
  orderDate: string;
  frontendRevenue?: number;
};

export type PreviewResult = {
  order: {
    product: string;
    pricePoint: string;
    affiliate: string;
    subAffiliate: string;
    orderDate: string;
    frontendRevenue: number;
  };
  resolution: {
    status: 'resolved' | 'no_rule';
    commission: number;
    winReason: string;
    specificityScore: number | null;
    winningRule: {
      ruleId: string;
      product: string;
      pricePoint: string;
      affiliate: string;
      subAffiliate: string;
      cpaType: CpaType;
      cpaValue: number;
      effectiveFrom: string;
      effectiveTo: string | null;
      specificityScore: number;
    } | null;
  };
  matchedCandidates: {
    ruleId: string;
    isWinner: boolean;
    specificityScore: number;
    outcomeCode: string;
    outcomeDetail: string;
    hypotheticalCommission: number | null;
  }[];
};

export const rulesApi = {
  list: () => api.get<RuleRow[]>('/rules'),
  nextId: () => api.get<{ ruleId: string }>('/rules/next-id'),
  overlap: (body: RulePayload & { id?: string; ruleId?: string }) =>
    api.post<OverlapResult>('/rules/overlap', body),
  preview: (body: PreviewPayload) => api.post<PreviewResult>('/rules/preview', body),
  create: (body: RulePayload) =>
    api.post<{ rule: RuleRow; overlap: OverlapResult }>('/rules', body),
  update: (id: string, body: RulePayload) =>
    api.put<{ rule: RuleRow; overlap: OverlapResult }>(`/rules/${id}`, body),
  deactivate: (id: string) => api.delete<RuleRow>(`/rules/${id}`),
};
