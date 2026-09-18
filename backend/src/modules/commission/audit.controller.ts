import type { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../errors/AppError.js';
import { auditService } from './audit.service.js';

export class AuditController {
  byOrderId = async (req: Request, res: Response) => {
    const orderId = String(req.params.orderId ?? '');
    if (!orderId) throw AppError.badRequest('orderId is required');

    try {
      const data = await auditService.byOrderId(orderId);
      return sendSuccess(res, data);
    } catch {
      throw AppError.notFound('Order not found');
    }
  };

  partnerOrders = async (req: Request, res: Response) => {
    const affiliateCode = String(req.params.affiliateCode ?? '');
    const dateFrom = String(req.query.dateFrom ?? '');
    const dateTo = String(req.query.dateTo ?? '');
    const limit = req.query.limit ? Number(req.query.limit) : 40;
    const data = await auditService.listPartnerOrders({
      affiliateCode,
      dateFrom,
      dateTo,
      limit,
    });
    return sendSuccess(res, data);
  };

  partnerRules = async (req: Request, res: Response) => {
    const affiliateCode = String(req.params.affiliateCode ?? '');
    const dateFrom = String(req.query.dateFrom ?? '');
    const dateTo = String(req.query.dateTo ?? '');
    const data = await auditService.listPartnerRules({
      affiliateCode,
      dateFrom,
      dateTo,
    });
    return sendSuccess(res, data);
  };

  winningRulesSummary = async (req: Request, res: Response) => {
    const dateFrom = String(req.query.dateFrom ?? '');
    const dateTo = String(req.query.dateTo ?? '');
    const data = await auditService.winningRulesSummary({ dateFrom, dateTo });
    return sendSuccess(res, data);
  };
}

export const auditController = new AuditController();
