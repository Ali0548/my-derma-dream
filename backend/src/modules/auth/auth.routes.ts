import { Router } from 'express';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { authenticate } from '../../middleware/auth.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { authController } from './auth.controller.js';
import { loginSchema } from './auth.validation.js';

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.get('/me', authenticate, asyncHandler(authController.me));

export default router;
