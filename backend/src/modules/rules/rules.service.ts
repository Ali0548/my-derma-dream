import { asc, eq, sql as dsql } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { cache } from '../../cache/index.js';
import { cpaRules } from '../../db/schema/index.js';
import { AppError } from '../../errors/AppError.js';
import {
  normalizePricePoint,
  specificityScore,
  type CpaType,
  type RuleInput,
} from '../commission/engine.js';
import { commissionService } from '../commission/commission.service.js';
import {
  detectOverlaps,
  normalizeDraftScopes,
  previewCommission,
  type RuleDraft,
} from './overlap.js';
import type { OverlapBody, PreviewBody, RuleBody } from './rules.validation.js';

function toDraft(row: typeof cpaRules.$inferSelect): RuleDraft {
  return {
    id: row.id,
    ruleId: row.ruleId,
    product: row.product ?? '',
    pricePoint: row.pricePoint ?? '',
    affiliate: row.affiliate ?? '',
    subAffiliate: row.subAffiliate ?? '',
    cpaType: row.cpaType as CpaType,
    cpaValue: Number(row.cpaValue),
    effectiveFrom: String(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? String(row.effectiveTo) : null,
  };
}

function toRuleInput(row: typeof cpaRules.$inferSelect): RuleInput {
  const draft = toDraft(row);
  return {
    id: draft.id!,
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

function serialize(row: typeof cpaRules.$inferSelect) {
  return {
    id: row.id,
    ruleId: row.ruleId,
    product: row.product || null,
    pricePoint: row.pricePoint || null,
    affiliate: row.affiliate || null,
    subAffiliate: row.subAffiliate || null,
    cpaType: row.cpaType as CpaType,
    cpaValue: Number(row.cpaValue),
    effectiveFrom: String(row.effectiveFrom),
    effectiveTo: row.effectiveTo ? String(row.effectiveTo) : null,
    specificityScore: row.specificityScore,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

let recalcQueued = false;

async function queueRecalc() {
  await cache.delByPrefix('report:');
  await cache.delByPrefix('rules:');
  if (recalcQueued) return;
  recalcQueued = true;
  setTimeout(() => {
    void (async () => {
      try {
        console.log('Rule change: recalculating commissions…');
        await commissionService.recalculateAll((done, total) => {
          if (done % 50000 === 0 || done === total) {
            console.log(`  recalc ${done}/${total}`);
          }
        });
        console.log('Rule change: recalculation complete');
      } catch (err) {
        console.error('Rule change: recalculation failed', err);
      } finally {
        recalcQueued = false;
      }
    })();
  }, 50);
}

export class RulesService {
  async list() {
    const rows = await db.select().from(cpaRules).orderBy(asc(cpaRules.ruleId));
    return rows.map(serialize);
  }

  async getById(id: string) {
    const [row] = await db.select().from(cpaRules).where(eq(cpaRules.id, id)).limit(1);
    if (!row) throw AppError.notFound('Rule not found');
    return serialize(row);
  }

  async nextRuleId(): Promise<string> {
    const [row] = await db
      .select({
        maxId: dsql<string>`MAX(${cpaRules.ruleId})`,
      })
      .from(cpaRules);

    const current = row?.maxId ?? 'R0000';
    const match = /^R(\d+)$/i.exec(current);
    const nextNum = match ? Number(match[1]) + 1 : 1;
    return `R${String(nextNum).padStart(4, '0')}`;
  }

  async checkOverlap(body: OverlapBody) {
    const draft = normalizeDraftScopes({
      id: body.id,
      ruleId: body.ruleId ?? '(draft)',
      product: body.product,
      pricePoint: body.pricePoint,
      affiliate: body.affiliate,
      subAffiliate: body.subAffiliate,
      cpaType: body.cpaType,
      cpaValue: body.cpaValue,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
    });

    const rows = await db
      .select()
      .from(cpaRules)
      .where(eq(cpaRules.isActive, true));

    const overlaps = detectOverlaps(draft, rows.map(toDraft));
    return {
      hasOverlap: overlaps.length > 0,
      overlapCount: overlaps.length,
      draftWouldWinCount: overlaps.filter((o) => o.draftWouldWin).length,
      draftWouldLoseCount: overlaps.filter((o) => !o.draftWouldWin).length,
      overlaps,
    };
  }

  async preview(body: PreviewBody) {
    const rows = await db.select().from(cpaRules).where(eq(cpaRules.isActive, true));
    return previewCommission(
      {
        product: body.product.trim(),
        pricePoint: normalizePricePoint(body.pricePoint),
        affiliate: (body.affiliate ?? '').trim(),
        subAffiliate: (body.subAffiliate ?? '').trim(),
        orderDate: body.orderDate,
        frontendRevenue: body.frontendRevenue,
      },
      rows.map(toRuleInput),
    );
  }

  async create(body: RuleBody, userId?: string) {
    const draft = normalizeDraftScopes({
      ruleId: await this.nextRuleId(),
      product: body.product,
      pricePoint: body.pricePoint,
      affiliate: body.affiliate,
      subAffiliate: body.subAffiliate,
      cpaType: body.cpaType,
      cpaValue: body.cpaValue,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
    });

    const score = specificityScore(draft);
    const [row] = await db
      .insert(cpaRules)
      .values({
        ruleId: draft.ruleId,
        product: draft.product,
        pricePoint: draft.pricePoint,
        affiliate: draft.affiliate,
        subAffiliate: draft.subAffiliate,
        cpaType: draft.cpaType,
        cpaValue: draft.cpaValue.toFixed(4),
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo,
        specificityScore: score,
        isActive: body.isActive ?? true,
        notes: body.notes ?? null,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
      })
      .returning();

    const overlap = await this.checkOverlap({
      ...body,
      id: row.id,
      ruleId: row.ruleId,
      effectiveTo: draft.effectiveTo,
    });

    await queueRecalc();
    return { rule: serialize(row), overlap };
  }

  async update(id: string, body: RuleBody, userId?: string) {
    const [existing] = await db.select().from(cpaRules).where(eq(cpaRules.id, id)).limit(1);
    if (!existing) throw AppError.notFound('Rule not found');

    const draft = normalizeDraftScopes({
      id,
      ruleId: existing.ruleId,
      product: body.product,
      pricePoint: body.pricePoint,
      affiliate: body.affiliate,
      subAffiliate: body.subAffiliate,
      cpaType: body.cpaType,
      cpaValue: body.cpaValue,
      effectiveFrom: body.effectiveFrom,
      effectiveTo: body.effectiveTo ?? null,
    });

    const score = specificityScore(draft);
    const [row] = await db
      .update(cpaRules)
      .set({
        product: draft.product,
        pricePoint: draft.pricePoint,
        affiliate: draft.affiliate,
        subAffiliate: draft.subAffiliate,
        cpaType: draft.cpaType,
        cpaValue: draft.cpaValue.toFixed(4),
        effectiveFrom: draft.effectiveFrom,
        effectiveTo: draft.effectiveTo,
        specificityScore: score,
        isActive: body.isActive ?? existing.isActive,
        notes: body.notes ?? null,
        updatedBy: userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(cpaRules.id, id))
      .returning();

    const overlap = await this.checkOverlap({
      ...body,
      id: row.id,
      ruleId: row.ruleId,
      effectiveTo: draft.effectiveTo,
    });

    await queueRecalc();
    return { rule: serialize(row), overlap };
  }

  async deactivate(id: string, userId?: string) {
    const [row] = await db
      .update(cpaRules)
      .set({
        isActive: false,
        updatedBy: userId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(cpaRules.id, id))
      .returning();

    if (!row) throw AppError.notFound('Rule not found');
    await queueRecalc();
    return serialize(row);
  }
}

export const rulesService = new RulesService();
