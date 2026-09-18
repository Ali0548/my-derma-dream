import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { rulesController } from './rules.controller.js';
import { overlapBodySchema, previewBodySchema, ruleBodySchema } from './rules.validation.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'manager'));

router.get('/', asyncHandler(rulesController.list));
router.get('/next-id', asyncHandler(rulesController.nextId));
router.post('/overlap', validate(overlapBodySchema), asyncHandler(rulesController.overlap));
router.post('/preview', validate(previewBodySchema), asyncHandler(rulesController.preview));
router.post('/', validate(ruleBodySchema), asyncHandler(rulesController.create));
router.get('/:id', asyncHandler(rulesController.getById));
router.put('/:id', validate(ruleBodySchema), asyncHandler(rulesController.update));
router.delete('/:id', asyncHandler(rulesController.deactivate));

export default router;
