import type { Request, Response } from 'express';
import { customerService } from '../services/customer.service';
import { ok } from '../utils/response';

export class CustomerController {
  create = async (req: Request, res: Response): Promise<void> => {
    ok(res, await customerService.create(req.body), 201);
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await customerService.list());
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    ok(res, await customerService.getById(req.params.id));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    ok(res, await customerService.update(req.params.id, req.body));
  };

  remove = async (req: Request, res: Response): Promise<void> => {
    await customerService.remove(req.params.id);
    ok(res, { deleted: true });
  };
}

export const customerController = new CustomerController();
