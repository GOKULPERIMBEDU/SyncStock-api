import { Router } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import {
  createCustomerSchema,
  customerIdParamSchema,
  updateCustomerSchema,
} from '../validators/customer.validator';

const router = Router();

router.get('/', asyncHandler(customerController.list));
router.post('/', validate(createCustomerSchema), asyncHandler(customerController.create));
router.get('/:id', validate(customerIdParamSchema), asyncHandler(customerController.getById));
router.patch('/:id', validate(updateCustomerSchema), asyncHandler(customerController.update));
router.delete(
  '/:id',
  authorize('Admin', 'Manager'),
  validate(customerIdParamSchema),
  asyncHandler(customerController.remove)
);

export default router;
