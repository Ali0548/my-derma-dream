import { z } from 'zod';

export const performanceQuerySchema = z.object({
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  affiliate: z.string().optional(),
  subAffiliate: z.string().optional(),
  product: z.string().optional(),
  pricePoint: z.string().optional(),
  roasMode: z.enum(['frontend', 'total']).default('frontend'),
});

export type PerformanceQuery = z.infer<typeof performanceQuerySchema>;
