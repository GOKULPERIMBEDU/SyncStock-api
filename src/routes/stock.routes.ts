import { Router } from 'express';
import { stockController } from '../controllers/stock.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { adjustStockSchema, stockChangeSchema } from '../validators/stock.validator';

const router = Router();

router.post(
  '/:productId/in',
  validate(stockChangeSchema),
  asyncHandler(stockController.restock)
);
router.post(
  '/:productId/out',
  validate(stockChangeSchema),
  asyncHandler(stockController.dispatch)
);
router.post(
  '/:productId/adjust',
  validate(adjustStockSchema),
  asyncHandler(stockController.adjust)
);

export default router;
