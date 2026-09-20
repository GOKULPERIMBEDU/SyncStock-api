import { Router } from 'express';
import { staffController } from '../controllers/staff.controller';
import { authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createStaffSchema, idParamSchema, updateStaffSchema } from '../validators/staff.validator';

const router = Router();

router.get('/', authorize('Admin', 'Manager'), asyncHandler(staffController.list));
router.post('/', authorize('Admin', 'Manager'), validate(createStaffSchema), asyncHandler(staffController.create));
router.get('/:id', authorize('Admin', 'Manager'), validate(idParamSchema), asyncHandler(staffController.getById));
router.patch('/:id', authorize('Admin', 'Manager'), validate(updateStaffSchema), asyncHandler(staffController.update));
router.delete('/:id', authorize('Admin'), validate(idParamSchema), asyncHandler(staffController.remove));

export default router;
