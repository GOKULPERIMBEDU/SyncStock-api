import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authorize, protect } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import {
  changePasswordSchema,
  createUserSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
  userIdParamSchema,
} from '../validators/auth.validator';

const router = Router();

router.post('/login', validate(loginSchema), asyncHandler(authController.login));
router.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post('/reset-password', validate(resetPasswordSchema), asyncHandler(authController.resetPassword));

router.get('/me', protect, asyncHandler(authController.me));
router.patch('/profile', protect, validate(updateProfileSchema), asyncHandler(authController.updateProfile));
router.patch('/password', protect, validate(changePasswordSchema), asyncHandler(authController.changePassword));

router.get('/users', protect, authorize('Admin', 'Manager'), asyncHandler(authController.listUsers));
router.post('/users', protect, authorize('Admin'), validate(createUserSchema), asyncHandler(authController.createUser));
router.delete(
  '/users/:id',
  protect,
  authorize('Admin'),
  validate(userIdParamSchema),
  asyncHandler(authController.deleteUser)
);

export default router;
