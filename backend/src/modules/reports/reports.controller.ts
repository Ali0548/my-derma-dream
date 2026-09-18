import type { Request, Response } from 'express';
import { reportsService } from './reports.service.js';
import { sendSuccess } from '../../utils/response.js';
import type { PerformanceQuery } from './reports.validation.js';

export class ReportsController {
  filters = async (_req: Request, res: Response) => {
    const data = await reportsService.getFilterOptions();
    return sendSuccess(res, data);
  };

  performance = async (req: Request, res: Response) => {
    const query = (req.validated?.query ?? req.query) as PerformanceQuery;
    const data = await reportsService.getPerformance({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      affiliate: query.affiliate || undefined,
      subAffiliate: query.subAffiliate || undefined,
      product: query.product || undefined,
      pricePoint: query.pricePoint || undefined,
      roasMode: query.roasMode ?? 'frontend',
    });
    return sendSuccess(res, data);
  };
}

export const reportsController = new ReportsController();
