import { z } from 'zod';

const scopeField = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null ? '' : String(v).trim()));

const optionalEndDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null || v === '') return null;
    return String(v);
  })
  .pipe(z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]));

export const ruleBodySchema = z
  .object({
    product: scopeField,
    pricePoint: scopeField,
    affiliate: scopeField,
    subAffiliate: scopeField,
    cpaType: z.enum(['fixed', 'percent']),
    cpaValue: z.coerce.number().positive('CPA value must be greater than 0'),
    effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'effectiveFrom must be YYYY-MM-DD'),
    effectiveTo: optionalEndDate,
    notes: z.union([z.string().max(2000), z.null(), z.undefined()]).optional(),
    isActive: z.boolean().optional().default(true),
  })
  .superRefine((val, ctx) => {
    if (val.effectiveTo && val.effectiveTo < val.effectiveFrom) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveTo'],
        message: 'effectiveTo must be on or after effectiveFrom',
      });
    }
  });

export const overlapBodySchema = ruleBodySchema.and(
  z.object({
    ruleId: z.string().optional(),
    id: z.string().uuid().optional(),
  }),
);

export const previewBodySchema = z.object({
  product: z.string().min(1, 'Product is required'),
  pricePoint: z.string().min(1, 'Price point is required'),
  affiliate: z.string().optional().default(''),
  subAffiliate: z.string().optional().default(''),
  orderDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  frontendRevenue: z.coerce.number().positive().optional(),
});

export type RuleBody = z.infer<typeof ruleBodySchema>;
export type OverlapBody = z.infer<typeof overlapBodySchema>;
export type PreviewBody = z.infer<typeof previewBodySchema>;
