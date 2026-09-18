import {
  calculateCommission,
  compareRules,
  normalizePricePoint,
  resolveCommission,
  specificityScore,
  type CpaType,
  type OrderInput,
  type RuleInput,
} from '../commission/engine.js';

export type RuleDraft = {
  ruleId: string;
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
  cpaType: CpaType;
  cpaValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  /** Optional stable id for edits — excluded from self-comparison. */
  id?: string;
};

function scopeCompatible(a: string, b: string): boolean {
  if (!a || !b) return true;
  return a === b;
}

/** Inclusive date ranges overlap when both cover at least one shared day. */
export function dateRangesOverlap(
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null,
): boolean {
  const aEnd = aTo ?? '9999-12-31';
  const bEnd = bTo ?? '9999-12-31';
  return aFrom <= bEnd && bFrom <= aEnd;
}

/**
 * Two rules compete when an order can match both at once
 * (compatible scopes on all four dimensions + overlapping dates).
 */
export function scopesCanCompete(a: RuleDraft, b: RuleDraft): boolean {
  return (
    scopeCompatible(a.product, b.product) &&
    scopeCompatible(a.pricePoint, b.pricePoint) &&
    scopeCompatible(a.affiliate, b.affiliate) &&
    scopeCompatible(a.subAffiliate, b.subAffiliate)
  );
}

export function rulesCompete(a: RuleDraft, b: RuleDraft): boolean {
  if (!scopesCanCompete(a, b)) return false;
  return dateRangesOverlap(a.effectiveFrom, a.effectiveTo, b.effectiveFrom, b.effectiveTo);
}

function toRuleInput(draft: RuleDraft): RuleInput {
  return {
    id: draft.id ?? draft.ruleId,
    ruleId: draft.ruleId,
    product: draft.product,
    pricePoint: draft.pricePoint,
    affiliate: draft.affiliate,
    subAffiliate: draft.subAffiliate,
    cpaType: draft.cpaType,
    cpaValue: draft.cpaValue,
    effectiveFrom: draft.effectiveFrom,
    effectiveTo: draft.effectiveTo,
  };
}

function describeScope(draft: RuleDraft): string {
  return [
    draft.product || 'any product',
    draft.pricePoint ? `price ${draft.pricePoint}` : 'any price',
    draft.affiliate || 'any affiliate',
    draft.subAffiliate || 'any sub',
  ].join(', ');
}

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

export function detectOverlaps(draft: RuleDraft, existing: RuleDraft[]): OverlapItem[] {
  const draftInput = toRuleInput(draft);
  const draftScore = specificityScore(draftInput);
  const overlaps: OverlapItem[] = [];

  for (const other of existing) {
    if (draft.id && other.id && draft.id === other.id) continue;
    if (draft.ruleId && other.ruleId && draft.ruleId === other.ruleId) continue;
    if (!rulesCompete(draft, other)) continue;

    const otherInput = toRuleInput(other);
    const otherScore = specificityScore(otherInput);
    const draftWins = compareRules(draftInput, otherInput) < 0;
    const winner = draftWins ? draft : other;

    let reason: string;
    if (draftScore !== otherScore) {
      reason = draftWins
        ? `Draft wins (specificity ${draftScore} > ${otherScore}).`
        : `${other.ruleId} wins (specificity ${otherScore} > ${draftScore}).`;
    } else if (draft.effectiveFrom !== other.effectiveFrom) {
      reason = draftWins
        ? `Same specificity; draft wins with later effective_from (${draft.effectiveFrom}).`
        : `Same specificity; ${other.ruleId} wins with later effective_from (${other.effectiveFrom}).`;
    } else {
      reason = draftWins
        ? `Same specificity and start date; draft wins on higher rule_id.`
        : `Same specificity and start date; ${other.ruleId} wins on higher rule_id.`;
    }

    overlaps.push({
      existingRuleId: other.ruleId,
      existingRuleUuid: other.id ?? other.ruleId,
      existingScope: describeScope(other),
      existingCpaType: other.cpaType,
      existingCpaValue: other.cpaValue,
      existingEffectiveFrom: other.effectiveFrom,
      existingEffectiveTo: other.effectiveTo,
      existingSpecificity: otherScore,
      draftWouldWin: draftWins,
      winnerRuleId: winner.ruleId,
      reason,
    });
  }

  return overlaps.sort((a, b) => a.existingRuleId.localeCompare(b.existingRuleId));
}

export type PreviewInput = {
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
  orderDate: string;
  /** Defaults to the price point when omitted. */
  frontendRevenue?: number;
};

export function previewCommission(input: PreviewInput, rules: RuleInput[]) {
  const pricePoint = normalizePricePoint(input.pricePoint);
  const frontendRevenue =
    input.frontendRevenue != null && Number.isFinite(input.frontendRevenue)
      ? Number(input.frontendRevenue)
      : Number(pricePoint) || 0;

  const order: OrderInput = {
    id: 'preview',
    orderId: 'PREVIEW',
    orderDate: input.orderDate,
    affiliateCode: input.affiliate,
    subAffiliateCode: input.subAffiliate,
    product1Name: input.product,
    pricePoint,
    frontendRevenue,
  };

  const resolution = resolveCommission(order, rules);
  return {
    order: {
      product: input.product,
      pricePoint,
      affiliate: input.affiliate,
      subAffiliate: input.subAffiliate,
      orderDate: input.orderDate,
      frontendRevenue,
    },
    resolution: {
      status: resolution.status,
      commission: resolution.commission,
      winReason: resolution.winReason,
      specificityScore: resolution.specificityScore,
      winningRule: resolution.winningRule
        ? {
            ruleId: resolution.winningRule.ruleId,
            product: resolution.winningRule.product,
            pricePoint: resolution.winningRule.pricePoint,
            affiliate: resolution.winningRule.affiliate,
            subAffiliate: resolution.winningRule.subAffiliate,
            cpaType: resolution.winningRule.cpaType,
            cpaValue: resolution.winningRule.cpaValue,
            effectiveFrom: resolution.winningRule.effectiveFrom,
            effectiveTo: resolution.winningRule.effectiveTo,
            specificityScore: specificityScore(resolution.winningRule),
          }
        : null,
    },
    matchedCandidates: resolution.evaluations
      .filter((e) => e.matched)
      .map((e) => ({
        ruleId: e.ruleId,
        isWinner: e.isWinner,
        specificityScore: e.specificityScore,
        outcomeCode: e.outcomeCode,
        outcomeDetail: e.outcomeDetail,
        hypotheticalCommission: e.hypotheticalCommission,
      })),
  };
}

export function normalizeDraftScopes(draft: Omit<RuleDraft, 'pricePoint'> & { pricePoint: string }): RuleDraft {
  return {
    ...draft,
    product: (draft.product ?? '').trim(),
    pricePoint: normalizePricePoint(draft.pricePoint),
    affiliate: (draft.affiliate ?? '').trim(),
    subAffiliate: (draft.subAffiliate ?? '').trim(),
  };
}

export { calculateCommission, specificityScore };
