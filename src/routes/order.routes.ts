import { Router } from 'express';
import { orderController } from '../controllers/order.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/staff.validator';
import { createOrderSchema, orderListQuerySchema, receiveOrderSchema, updateOrderSchema } from '../validators/order.validator';

const router = Router();

router.get('/', validate(orderListQuerySchema), asyncHandler(orderController.list));
router.get('/clients', asyncHandler(orderController.clients));
router.post('/', validate(createOrderSchema), asyncHandler(orderController.create));
router.get('/:id', validate(idParamSchema), asyncHandler(orderController.getById));
router.patch('/:id', validate(updateOrderSchema), asyncHandler(orderController.update));
router.post('/:id/receive', validate(receiveOrderSchema), asyncHandler(orderController.receive));
router.delete('/:id', validate(idParamSchema), asyncHandler(orderController.remove));

export default router;
