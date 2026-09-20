import { Router } from 'express';
import { accountController } from '../controllers/account.controller';
import { asyncHandler } from '../middleware/asyncHandler';
import { validate } from '../middleware/validate';
import { createAccountSchema, updateAccountSchema } from '../validators/account.validator';
import { idParamSchema } from '../validators/staff.validator';

const router = Router();

router.get('/', asyncHandler(accountController.list));
router.post('/', validate(createAccountSchema), asyncHandler(accountController.create));
router.get('/:id', validate(idParamSchema), asyncHandler(accountController.getById));
router.patch('/:id', validate(updateAccountSchema), asyncHandler(accountController.update));
router.delete('/:id', validate(idParamSchema), asyncHandler(accountController.remove));

export default router;
