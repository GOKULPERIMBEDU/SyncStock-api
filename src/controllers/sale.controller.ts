import type { Request, Response } from 'express';
import { saleService } from '../services/sale.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/response';

export class SaleController {
  create = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError(401, 'Authentication required');
    const sale = await saleService.create({
      customerRef: req.body.customerRef,
      items: req.body.items,
      createdBy: req.user.id,
    });
    ok(res, sale, 201);
  };

  list = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await saleService.list());
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    ok(res, await saleService.getById(req.params.id));
  };
}

export const saleController = new SaleController();
