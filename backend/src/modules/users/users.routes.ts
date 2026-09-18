import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate, requireRole } from '../../middleware/auth.middleware.js';
import { usersController } from './users.controller.js';

const router = Router();

router.use(authenticate, requireRole('admin', 'manager'));

router.get('/', asyncHandler(usersController.list));
router.get('/:id', asyncHandler(usersController.getById));

export default router;
