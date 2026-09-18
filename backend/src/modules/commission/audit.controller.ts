import type { Request, Response } from 'express';
import { commissionService } from './commission.service.js';
import { sendSuccess } from '../../utils/response.js';
import { AppError } from '../../errors/AppError.js';

export class AuditController {
  byOrderId = async (req: Request, res: Response) => {
    const orderId = String(req.params.orderId ?? '');
    if (!orderId) throw AppError.badRequest('orderId is required');

    try {
      const { order, resolution } = await commissionService.resolveOrderByOrderId(orderId);
      return sendSuccess(res, {
        order: {
          orderId: order.orderId,
          orderDate: order.orderDate,
          affiliateCode: order.affiliateCode,
          subAffiliateCode: order.subAffiliateCode,
          product1Name: order.product1Name,
          product1Price: order.product1Price,
          pricePoint: order.pricePoint,
          frontendRevenue: order.frontendRevenue,
          upsellRevenue: order.upsellRevenue,
          totalRevenue: order.totalRevenue,
          storedCommission: order.commission,
          storedRuleId: order.appliedRuleId,
          winReason: order.winReason,
        },
        resolution,
      });
    } catch {
      throw AppError.notFound('Order not found');
    }
  };
}

export const auditController = new AuditController();
