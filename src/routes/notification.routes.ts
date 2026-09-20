import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { notificationIdParamSchema } from '../validators/notification.validator';

const router = Router();

router.get('/', asyncHandler(notificationController.list));
router.patch('/:id/read', validate(notificationIdParamSchema), asyncHandler(notificationController.markRead));

export default router;
