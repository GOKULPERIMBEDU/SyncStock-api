import { Router } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createPaymentSchema, updatePaymentSchema } from '../validators/payment.validator';
import { idParamSchema } from '../validators/staff.validator';

const router = Router();

router.get('/', asyncHandler(paymentController.list));
router.post('/', validate(createPaymentSchema), asyncHandler(paymentController.create));
router.get('/:id', validate(idParamSchema), asyncHandler(paymentController.getById));
router.patch('/:id', validate(updatePaymentSchema), asyncHandler(paymentController.update));
router.delete('/:id', validate(idParamSchema), asyncHandler(paymentController.remove));

export default router;
