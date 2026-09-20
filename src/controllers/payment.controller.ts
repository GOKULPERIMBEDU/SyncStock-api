import type { Request, Response } from 'express';
import { paymentService } from '../services/payment.service';
import { ok } from '../utils/response';

export class PaymentController {
  create = async (req: Request, res: Response): Promise<void> => {
    ok(res, await paymentService.create(req.body), 201);
  };
  list = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await paymentService.list());
  };
  getById = async (req: Request, res: Response): Promise<void> => {
    ok(res, await paymentService.getById(req.params.id));
  };
  update = async (req: Request, res: Response): Promise<void> => {
    ok(res, await paymentService.update(req.params.id, req.body));
  };
  remove = async (req: Request, res: Response): Promise<void> => {
    await paymentService.remove(req.params.id);
    ok(res, { deleted: true });
  };
}

export const paymentController = new PaymentController();
