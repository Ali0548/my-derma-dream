import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { auditController } from './audit.controller.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'manager'));
router.get('/orders/:orderId', asyncHandler(auditController.byOrderId));

export default router;
