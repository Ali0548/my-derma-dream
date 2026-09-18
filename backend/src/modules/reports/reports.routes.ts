import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { reportsController } from './reports.controller.js';
import { performanceQuerySchema } from './reports.validation.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'manager'));

router.get('/filters', asyncHandler(reportsController.filters));
router.get(
  '/performance',
  validate(performanceQuerySchema, 'query'),
  asyncHandler(reportsController.performance),
);

export default router;
