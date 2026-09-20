import { Router } from 'express';
import { settingController } from '../controllers/setting.controller';
import { authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { updateSettingSchema } from '../validators/setting.validator';

const router = Router();

router.get('/', authorize('Admin', 'Manager'), asyncHandler(settingController.get));
router.patch('/', authorize('Admin'), validate(updateSettingSchema), asyncHandler(settingController.update));

export default router;
