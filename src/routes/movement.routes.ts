import { Router } from 'express';
import { stockController } from '../controllers/stock.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { movementsQuerySchema } from '../validators/stock.validator';

const router = Router();

router.get('/', validate(movementsQuerySchema), asyncHandler(stockController.listMovements));

export default router;
