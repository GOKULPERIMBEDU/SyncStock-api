import { Router } from 'express';
import { saleController } from '../controllers/sale.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createSaleSchema, saleIdParamSchema } from '../validators/sale.validator';

const router = Router();

router.get('/', asyncHandler(saleController.list));
router.post('/', validate(createSaleSchema), asyncHandler(saleController.create));
router.get('/:id', validate(saleIdParamSchema), asyncHandler(saleController.getById));

export default router;
