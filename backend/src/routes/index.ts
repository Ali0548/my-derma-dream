import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes.js';
import usersRoutes from '../modules/users/users.routes.js';
import reportsRoutes from '../modules/reports/reports.routes.js';
import auditRoutes from '../modules/commission/audit.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'lumora-api',
      timestamp: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/reports', reportsRoutes);
router.use('/audit', auditRoutes);

export default router;
