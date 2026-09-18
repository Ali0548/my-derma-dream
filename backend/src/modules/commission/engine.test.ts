import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateCommission,
  compareRules,
  normalizePricePoint,
  resolveCommission,
  resolveCommissionFast,
  specificityScore,
  type OrderInput,
  type RuleInput,
} from './engine.js';

function rule(partial: Partial<RuleInput> & Pick<RuleInput, 'ruleId'>): RuleInput {
  return {
    id: partial.id ?? partial.ruleId,
    ruleId: partial.ruleId,
    product: partial.product ?? '',
    pricePoint: partial.pricePoint ?? '',
    affiliate: partial.affiliate ?? '',
    subAffiliate: partial.subAffiliate ?? '',
    cpaType: partial.cpaType ?? 'fixed',
    cpaValue: partial.cpaValue ?? 10,
    effectiveFrom: partial.effectiveFrom ?? '2024-01-01',
    effectiveTo: partial.effectiveTo ?? null,
  };
}

function order(partial: Partial<OrderInput> = {}): OrderInput {
  return {
    id: '1',
    orderId: partial.orderId ?? 'ORD1',
    orderDate: partial.orderDate ?? '2024-06-15',
    affiliateCode: partial.affiliateCode ?? 'AFF1',
    subAffiliateCode: partial.subAffiliateCode ?? 'SUB1',
    product1Name: partial.product1Name ?? 'Serum',
    pricePoint: partial.pricePoint ?? '49',
    frontendRevenue: partial.frontendRevenue ?? 49,
  };
}

describe('normalizePricePoint', () => {
  it('normalizes numeric strings', () => {
    assert.equal(normalizePricePoint('49.00'), '49');
    assert.equal(normalizePricePoint(49), '49');
  });
});

describe('specificityScore', () => {
  it('weights the ladder product < price < affiliate < sub', () => {
    assert.equal(specificityScore(rule({ ruleId: 'a', product: 'X' })), 1);
    assert.equal(specificityScore(rule({ ruleId: 'b', pricePoint: '49' })), 2);
    assert.equal(specificityScore(rule({ ruleId: 'c', affiliate: 'A' })), 4);
    assert.equal(specificityScore(rule({ ruleId: 'd', subAffiliate: 'S' })), 8);
    assert.equal(
      specificityScore(
        rule({
          ruleId: 'e',
          product: 'X',
          pricePoint: '49',
          affiliate: 'A',
          subAffiliate: 'S',
        }),
      ),
      15,
    );
  });
});

describe('calculateCommission', () => {
  it('pays fixed and percent of front-end only', () => {
    assert.equal(calculateCommission('fixed', 12.5, 100), 12.5);
    assert.equal(calculateCommission('percent', 10, 49), 4.9);
  });
});

describe('resolveCommission', () => {
  it('picks the more specific matching rule', () => {
    const rules = [
      rule({ ruleId: 'R1', cpaType: 'percent', cpaValue: 10 }),
      rule({
        ruleId: 'R2',
        affiliate: 'AFF1',
        cpaType: 'fixed',
        cpaValue: 20,
      }),
      rule({
        ruleId: 'R3',
        affiliate: 'AFF1',
        subAffiliate: 'SUB1',
        cpaType: 'fixed',
        cpaValue: 35,
      }),
    ];

    const result = resolveCommission(order(), rules);
    assert.equal(result.status, 'resolved');
    assert.equal(result.winningRule?.ruleId, 'R3');
    assert.equal(result.commission, 35);

    const winner = result.evaluations.find((e) => e.isWinner);
    assert.equal(winner?.ruleId, 'R3');
    assert.equal(
      result.evaluations.find((e) => e.ruleId === 'R2')?.outcomeCode,
      'lower_specificity',
    );
  });

  it('requires exact price point match when scoped', () => {
    const rules = [
      rule({
        ruleId: 'RPRICE',
        pricePoint: '49',
        cpaType: 'fixed',
        cpaValue: 8,
      }),
      rule({
        ruleId: 'ROTHER',
        pricePoint: '59',
        cpaType: 'fixed',
        cpaValue: 99,
      }),
    ];

    const result = resolveCommission(order({ pricePoint: '49' }), rules);
    assert.equal(result.winningRule?.ruleId, 'RPRICE');
    assert.equal(
      result.evaluations.find((e) => e.ruleId === 'ROTHER')?.outcomeCode,
      'scope_mismatch',
    );
  });

  it('respects inclusive effective dates', () => {
    const rules = [
      rule({
        ruleId: 'OLD',
        effectiveFrom: '2024-01-01',
        effectiveTo: '2024-06-14',
        cpaValue: 1,
      }),
      rule({
        ruleId: 'NEW',
        effectiveFrom: '2024-06-15',
        effectiveTo: '2024-12-31',
        cpaValue: 2,
      }),
    ];

    assert.equal(resolveCommission(order({ orderDate: '2024-06-15' }), rules).winningRule?.ruleId, 'NEW');
    assert.equal(resolveCommission(order({ orderDate: '2024-06-14' }), rules).winningRule?.ruleId, 'OLD');
  });

  it('tie-breaks later effective_from then higher rule_id', () => {
    const a = rule({
      ruleId: 'R0010',
      affiliate: 'AFF1',
      effectiveFrom: '2024-01-01',
      cpaValue: 10,
    });
    const b = rule({
      ruleId: 'R0009',
      affiliate: 'AFF1',
      effectiveFrom: '2024-03-01',
      cpaValue: 11,
    });
    assert.ok(compareRules(b, a) < 0);
    assert.equal(resolveCommission(order(), [a, b]).winningRule?.ruleId, 'R0009');
  });

  it('fast path matches full path commission', () => {
    const rules = [
      rule({ ruleId: 'A', product: 'Serum', cpaType: 'percent', cpaValue: 12 }),
      rule({ ruleId: 'B', affiliate: 'AFF1', subAffiliate: 'SUB1', cpaValue: 40 }),
    ];
    const o = order();
    const full = resolveCommission(o, rules);
    const fast = resolveCommissionFast(o, rules);
    assert.equal(fast.winningRule?.ruleId, full.winningRule?.ruleId);
    assert.equal(fast.commission, full.commission);
  });
});
