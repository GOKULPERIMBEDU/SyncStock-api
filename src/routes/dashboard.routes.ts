import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

router.get('/', asyncHandler(dashboardController.summary));

export default router;
