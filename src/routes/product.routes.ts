import { Router } from 'express';
import { productController } from '../controllers/product.controller';
import { authorize } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import {
  createProductSchema,
  productIdParamSchema,
  productListQuerySchema,
  updateProductSchema,
} from '../validators/product.validator';

const router = Router();

router.get('/', validate(productListQuerySchema), asyncHandler(productController.list));
router.post('/', validate(createProductSchema), asyncHandler(productController.create));
router.get('/categories', asyncHandler(productController.categories));
router.get('/:id', validate(productIdParamSchema), asyncHandler(productController.getById));
router.patch('/:id', validate(updateProductSchema), asyncHandler(productController.update));
router.delete('/:id', authorize('Admin'), validate(productIdParamSchema), asyncHandler(productController.remove));

export default router;
