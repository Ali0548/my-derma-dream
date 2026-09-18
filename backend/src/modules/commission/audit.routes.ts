import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { auditController } from './audit.controller.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'manager'));
router.get('/partners/winning-rules', asyncHandler(auditController.winningRulesSummary));
router.get('/partners/:affiliateCode/rules', asyncHandler(auditController.partnerRules));
router.get('/partners/:affiliateCode/orders', asyncHandler(auditController.partnerOrders));
router.get('/orders/:orderId', asyncHandler(auditController.byOrderId));

export default router;
