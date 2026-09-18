/**
 * Pure commission resolution.
 * Price match is exact (normalized price points). Dates use inclusive range.
 */

export type CpaType = 'fixed' | 'percent';

export type RuleInput = {
  id: string;
  ruleId: string;
  product: string;
  pricePoint: string;
  affiliate: string;
  subAffiliate: string;
  cpaType: CpaType;
  cpaValue: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
};

export type OrderInput = {
  id: string;
  orderId: string;
  orderDate: string;
  affiliateCode: string;
  subAffiliateCode: string;
  product1Name: string;
  pricePoint: string;
  frontendRevenue: number;
};

export type OutcomeCode =
  | 'winner'
  | 'date_out_of_range'
  | 'scope_mismatch'
  | 'lower_specificity'
  | 'tie_lost'
  | 'no_candidates';

export type RuleEvaluation = {
  ruleId: string;
  ruleUuid: string;
  matched: boolean;
  isWinner: boolean;
  specificityScore: number;
  outcomeCode: OutcomeCode;
  outcomeDetail: string;
  cpaType: CpaType | null;
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

export type ResolutionResult = {
  status: 'resolved' | 'no_rule';
  commission: number;
  winningRule: RuleInput | null;
  specificityScore: number | null;
  winReason: string;
  evaluations: RuleEvaluation[];
};

/** Ladder weights: product < price < affiliate < sub-affiliate */
export function specificityScore(
  rule: Pick<RuleInput, 'product' | 'pricePoint' | 'affiliate' | 'subAffiliate'>,
): number {
  let score = 0;
  if (rule.product) score += 1;
  if (rule.pricePoint) score += 2;
  if (rule.affiliate) score += 4;
  if (rule.subAffiliate) score += 8;
  return score;
}

export function normalizePricePoint(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value).trim();
  return String(num);
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCommission(
  cpaType: CpaType,
  cpaValue: number,
  frontendRevenue: number,
): number {
  if (cpaType === 'fixed') {
    return roundMoney(cpaValue);
  }
  return roundMoney((frontendRevenue * cpaValue) / 100);
}

function inDateRange(orderDate: string, from: string, to: string | null): boolean {
  if (orderDate < from) return false;
  if (to && orderDate > to) return false;
  return true;
}

function scopeMatches(rule: RuleInput, order: OrderInput): { ok: boolean; detail: string } {
  if (rule.product && rule.product !== order.product1Name) {
    return { ok: false, detail: `Product "${rule.product}" ≠ order "${order.product1Name}"` };
  }
  if (rule.pricePoint && rule.pricePoint !== order.pricePoint) {
    return { ok: false, detail: `Price point "${rule.pricePoint}" ≠ order "${order.pricePoint}"` };
  }
  if (rule.affiliate && rule.affiliate !== order.affiliateCode) {
    return {
      ok: false,
      detail: `Affiliate "${rule.affiliate}" ≠ order "${order.affiliateCode || '(blank)'}"`,
    };
  }
  if (rule.subAffiliate && rule.subAffiliate !== order.subAffiliateCode) {
    return {
      ok: false,
      detail: `Sub-affiliate "${rule.subAffiliate}" ≠ order "${order.subAffiliateCode || '(blank)'}"`,
    };
  }
  return { ok: true, detail: 'All filled scopes match' };
}

/**
 * Tie-break when specificity is equal:
 * 1) later effective_from wins
 * 2) higher rule_id wins (stable, deterministic)
 */
export function compareRules(a: RuleInput, b: RuleInput): number {
  const scoreDiff = specificityScore(b) - specificityScore(a);
  if (scoreDiff !== 0) return scoreDiff;
  if (a.effectiveFrom !== b.effectiveFrom) {
    return a.effectiveFrom < b.effectiveFrom ? 1 : -1;
  }
  return a.ruleId < b.ruleId ? 1 : a.ruleId > b.ruleId ? -1 : 0;
}

function describeScope(rule: RuleInput): string {
  const parts = [
    rule.product || 'any product',
    rule.pricePoint ? `price $${rule.pricePoint}` : 'any price',
    rule.affiliate || 'any affiliate',
    rule.subAffiliate || 'any sub',
  ];
  return parts.join(', ');
}

function scoreBreakdown(rule: RuleInput): string {
  const bits: string[] = [];
  if (rule.product) bits.push('product +1');
  if (rule.pricePoint) bits.push('price +2');
  if (rule.affiliate) bits.push('affiliate +4');
  if (rule.subAffiliate) bits.push('sub-affiliate +8');
  if (bits.length === 0) return 'catch-all (0) — matches everything';
  return `${bits.join(', ')} = ${specificityScore(rule)}`;
}

function baseEvaluation(
  rule: RuleInput,
  partial: Pick<
    RuleEvaluation,
    'matched' | 'isWinner' | 'outcomeCode' | 'outcomeDetail' | 'hypotheticalCommission'
  >,
): RuleEvaluation {
  return {
    ruleId: rule.ruleId,
    ruleUuid: rule.id,
    specificityScore: specificityScore(rule),
    cpaType: rule.cpaType,
    cpaValue: rule.cpaValue,
    product: rule.product,
    pricePoint: rule.pricePoint,
    affiliate: rule.affiliate,
    subAffiliate: rule.subAffiliate,
    effectiveFrom: rule.effectiveFrom,
    effectiveTo: rule.effectiveTo,
    scoreBreakdown: scoreBreakdown(rule),
    ...partial,
  };
}

/** Fast path for bulk recalc — no per-rule audit trail. */
export function resolveCommissionFast(
  order: OrderInput,
  rules: RuleInput[],
): Pick<ResolutionResult, 'status' | 'commission' | 'winningRule' | 'specificityScore' | 'winReason'> {
  let winner: RuleInput | null = null;

  for (const rule of rules) {
    if (!inDateRange(order.orderDate, rule.effectiveFrom, rule.effectiveTo)) continue;
    if (!scopeMatches(rule, order).ok) continue;
    if (!winner || compareRules(rule, winner) < 0) {
      winner = rule;
    }
  }

  if (!winner) {
    return {
      status: 'no_rule',
      commission: 0,
      winningRule: null,
      specificityScore: null,
      winReason: 'No active rule matched this order’s product, price, partner, sub, and date.',
    };
  }

  const score = specificityScore(winner);
  const commission = calculateCommission(winner.cpaType, winner.cpaValue, order.frontendRevenue);
  return {
    status: 'resolved',
    commission,
    winningRule: winner,
    specificityScore: score,
    winReason: `${winner.ruleId} won (specificity ${score}: ${describeScope(winner)}). Commission ${
      winner.cpaType
    } ${winner.cpaValue}${winner.cpaType === 'percent' ? '%' : ''} on front-end $${order.frontendRevenue.toFixed(2)} = $${commission.toFixed(2)}.`,
  };
}

export function resolveCommission(order: OrderInput, rules: RuleInput[]): ResolutionResult {
  const evaluations: RuleEvaluation[] = [];
  const candidates: RuleInput[] = [];

  for (const rule of rules) {
    const score = specificityScore(rule);

    if (!inDateRange(order.orderDate, rule.effectiveFrom, rule.effectiveTo)) {
      evaluations.push(
        baseEvaluation(rule, {
          matched: false,
          isWinner: false,
          outcomeCode: 'date_out_of_range',
          outcomeDetail: `${rule.ruleId} skipped: order date ${order.orderDate} is outside this rule’s effective window (${rule.effectiveFrom} → ${rule.effectiveTo ?? 'no end'}). Even though its scope is “${describeScope(rule)}”, dates must overlap first.`,
          hypotheticalCommission: null,
        }),
      );
      continue;
    }

    const scope = scopeMatches(rule, order);
    if (!scope.ok) {
      evaluations.push(
        baseEvaluation(rule, {
          matched: false,
          isWinner: false,
          outcomeCode: 'scope_mismatch',
          outcomeDetail: `${rule.ruleId} skipped: ${scope.detail}. This rule only covers “${describeScope(rule)}”, so it cannot pay this order.`,
          hypotheticalCommission: null,
        }),
      );
      continue;
    }

    candidates.push(rule);
    evaluations.push(
      baseEvaluation(rule, {
        matched: true,
        isWinner: false,
        outcomeCode: 'lower_specificity',
        outcomeDetail: `${rule.ruleId} matched this order (${describeScope(rule)}; score ${score}: ${scoreBreakdown(rule)}). Waiting to compare against other matches…`,
        hypotheticalCommission: calculateCommission(rule.cpaType, rule.cpaValue, order.frontendRevenue),
      }),
    );
  }

  if (candidates.length === 0) {
    return {
      status: 'no_rule',
      commission: 0,
      winningRule: null,
      specificityScore: null,
      winReason: 'No active rule matched this order’s product, price, partner, sub, and date.',
      evaluations: evaluations.length
        ? evaluations
        : [
            {
              ruleId: '—',
              ruleUuid: '',
              matched: false,
              isWinner: false,
              specificityScore: 0,
              outcomeCode: 'no_candidates',
              outcomeDetail: 'No rules were available to evaluate',
              cpaType: null,
              cpaValue: null,
              hypotheticalCommission: null,
              product: '',
              pricePoint: '',
              affiliate: '',
              subAffiliate: '',
              effectiveFrom: '',
              effectiveTo: null,
              scoreBreakdown: 'n/a',
            },
          ],
    };
  }

  const ranked = [...candidates].sort(compareRules);
  const winner = ranked[0];
  const winnerScore = specificityScore(winner);
  const commission = calculateCommission(winner.cpaType, winner.cpaValue, order.frontendRevenue);

  for (const evaluation of evaluations) {
    if (!evaluation.matched) continue;
    if (evaluation.ruleId === winner.ruleId) {
      evaluation.isWinner = true;
      evaluation.outcomeCode = 'winner';
      evaluation.outcomeDetail = `${winner.ruleId} applied (winner). It is the most specific match for this order: “${describeScope(winner)}”. Score ${winnerScore} comes from ${scoreBreakdown(winner)}. CPA ${winner.cpaType === 'percent' ? `${winner.cpaValue}% of front-end` : `fixed $${winner.cpaValue}`} on $${order.frontendRevenue.toFixed(2)} → $${commission.toFixed(2)}.`;
      continue;
    }

    const other = candidates.find((r) => r.ruleId === evaluation.ruleId);
    if (!other) continue;
    const otherScore = specificityScore(other);
    if (otherScore < winnerScore) {
      evaluation.outcomeCode = 'lower_specificity';
      evaluation.outcomeDetail = `${other.ruleId} skipped: it did match, but it is less specific than ${winner.ruleId}. ${other.ruleId} scores ${otherScore} (${scoreBreakdown(other)}) vs winner ${winnerScore} (${scoreBreakdown(winner)}). Ladder weights: product +1, price +2, affiliate +4, sub-affiliate +8 — higher total wins.`;
    } else {
      evaluation.outcomeCode = 'tie_lost';
      evaluation.outcomeDetail = `${other.ruleId} skipped: same specificity (${otherScore}) as ${winner.ruleId}, so tie-break applies — later effective_from wins, then higher rule_id. Winner ${winner.ruleId} starts ${winner.effectiveFrom} (id ${winner.ruleId}); this rule starts ${other.effectiveFrom} (id ${other.ruleId}).`;
    }
  }

  return {
    status: 'resolved',
    commission,
    winningRule: winner,
    specificityScore: winnerScore,
    winReason: `${winner.ruleId} paid this order. Why: most specific matching rule — “${describeScope(winner)}” (score ${winnerScore}: ${scoreBreakdown(winner)}). Math: ${
      winner.cpaType === 'percent'
        ? `${winner.cpaValue}% × front-end $${order.frontendRevenue.toFixed(2)}`
        : `fixed $${winner.cpaValue}`
    } = $${commission.toFixed(2)}. Other matching rules lost on specificity or tie-break; mismatched/date rules never entered the contest.`,
    evaluations,
  };
}
