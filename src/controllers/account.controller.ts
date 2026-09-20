import type { Request, Response } from 'express';
import { accountService } from '../services/account.service';
import { ok } from '../utils/response';

export class AccountController {
  create = async (req: Request, res: Response): Promise<void> => {
    ok(res, await accountService.create(req.body), 201);
  };
  list = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await accountService.list());
  };
  getById = async (req: Request, res: Response): Promise<void> => {
    ok(res, await accountService.getById(req.params.id));
  };
  update = async (req: Request, res: Response): Promise<void> => {
    ok(res, await accountService.update(req.params.id, req.body));
  };
  remove = async (req: Request, res: Response): Promise<void> => {
    await accountService.remove(req.params.id);
    ok(res, { deleted: true });
  };
}

export const accountController = new AccountController();
