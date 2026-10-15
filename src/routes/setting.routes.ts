import { Router } from 'express';
import { settingController } from '../controllers/setting.controller';
import { authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createWorkspaceSchema, updateSettingSchema } from '../validators/setting.validator';

const router = Router();

/** Any signed-in user: the workspace list behind the header switcher (currency / tax / categories per workspace). */
router.get('/workspaces', asyncHandler(settingController.listWorkspaces));
router.post('/workspaces', authorize('Admin'), validate(createWorkspaceSchema), asyncHandler(settingController.createWorkspace));

/** The active workspace (`X-Tenant-Id`) - read for Admin / Manager, edit for Admin. */
router.get('/', authorize('Admin', 'Manager'), asyncHandler(settingController.get));
router.patch('/', authorize('Admin'), validate(updateSettingSchema), asyncHandler(settingController.update));

export default router;
