import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dateRangesOverlap, detectOverlaps, previewCommission, rulesCompete, type RuleDraft } from './overlap.js';
import type { RuleInput } from '../commission/engine.js';

function draft(partial: Partial<RuleDraft> & Pick<RuleDraft, 'ruleId'>): RuleDraft {
  return {
    ruleId: partial.ruleId,
    id: partial.id,
    product: partial.product ?? '',
    pricePoint: partial.pricePoint ?? '',
    affiliate: partial.affiliate ?? '',
    subAffiliate: partial.subAffiliate ?? '',
    cpaType: partial.cpaType ?? 'fixed',
    cpaValue: partial.cpaValue ?? 10,
    effectiveFrom: partial.effectiveFrom ?? '2025-01-01',
    effectiveTo: partial.effectiveTo === undefined ? null : partial.effectiveTo,
  };
}

describe('dateRangesOverlap', () => {
  it('detects inclusive overlap and open-ended ranges', () => {
    assert.equal(dateRangesOverlap('2025-01-01', '2025-06-30', '2025-06-30', '2025-12-31'), true);
    assert.equal(dateRangesOverlap('2025-01-01', '2025-03-01', '2025-03-02', null), false);
    assert.equal(dateRangesOverlap('2025-01-01', null, '2026-01-01', '2026-02-01'), true);
  });
});

describe('rulesCompete', () => {
  it('treats any as compatible with a specific value', () => {
    assert.equal(
      rulesCompete(
        draft({ ruleId: 'A', product: 'Serum' }),
        draft({ ruleId: 'B', product: '', affiliate: 'AFF1' }),
      ),
      true,
    );
  });

  it('does not compete when specific products differ', () => {
    assert.equal(
      rulesCompete(
        draft({ ruleId: 'A', product: 'Serum' }),
        draft({ ruleId: 'B', product: 'Cream' }),
      ),
      false,
    );
  });
});

describe('detectOverlaps', () => {
  it('warns and reports which rule would win', () => {
    const existing = [
      draft({
        ruleId: 'R0001',
        id: 'u1',
        affiliate: 'AFF1',
        cpaValue: 20,
        effectiveFrom: '2025-01-01',
      }),
    ];
    const overlaps = detectOverlaps(
      draft({
        ruleId: '(draft)',
        product: 'Serum',
        affiliate: 'AFF1',
        subAffiliate: 'SUB1',
        cpaValue: 35,
        effectiveFrom: '2025-06-01',
      }),
      existing,
    );

    assert.equal(overlaps.length, 1);
    assert.equal(overlaps[0].draftWouldWin, true);
    assert.equal(overlaps[0].winnerRuleId, '(draft)');
  });

  it('skips self when editing', () => {
    const self = draft({
      ruleId: 'R0005',
      id: 'same',
      affiliate: 'AFF1',
    });
    assert.equal(detectOverlaps(self, [self]).length, 0);
  });
});

describe('previewCommission', () => {
  it('returns the winning rule and commission', () => {
    const rules: RuleInput[] = [
      {
        id: '1',
        ruleId: 'R1',
        product: '',
        pricePoint: '',
        affiliate: '',
        subAffiliate: '',
        cpaType: 'percent',
        cpaValue: 10,
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
      },
      {
        id: '2',
        ruleId: 'R2',
        product: 'Serum',
        pricePoint: '49',
        affiliate: 'AFF1',
        subAffiliate: '',
        cpaType: 'fixed',
        cpaValue: 12,
        effectiveFrom: '2025-01-01',
        effectiveTo: null,
      },
    ];

    const result = previewCommission(
      {
        product: 'Serum',
        pricePoint: '49',
        affiliate: 'AFF1',
        subAffiliate: '',
        orderDate: '2025-08-01',
      },
      rules,
    );

    assert.equal(result.resolution.winningRule?.ruleId, 'R2');
    assert.equal(result.resolution.commission, 12);
  });
});
