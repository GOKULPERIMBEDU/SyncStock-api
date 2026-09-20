import type { Request, Response } from 'express';
import { stockService } from '../services/stock.service';
import type { MovementType } from '../types';
import { ok } from '../utils/response';

export class StockController {
  restock = async (req: Request, res: Response): Promise<void> => {
    const result = await stockService.restock(req.params.productId, req.body, req.user?.id);
    ok(res, result, 201);
  };

  dispatch = async (req: Request, res: Response): Promise<void> => {
    const result = await stockService.dispatch(req.params.productId, req.body, req.user?.id);
    ok(res, result, 201);
  };

  adjust = async (req: Request, res: Response): Promise<void> => {
    const result = await stockService.adjust(req.params.productId, req.body, req.user?.id);
    ok(res, result, 201);
  };

  listMovements = async (req: Request, res: Response): Promise<void> => {
    const { productId, type, limit } = req.query;
    const movements = await stockService.listMovements({
      productId: typeof productId === 'string' ? productId : undefined,
      type: type as MovementType | undefined,
      limit: limit ? Number(limit) : undefined,
    });
    ok(res, movements);
  };
}

export const stockController = new StockController();
