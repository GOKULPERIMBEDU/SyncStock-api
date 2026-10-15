import type { Request, Response } from 'express';
import { orderService } from '../services/order.service';
import { ok } from '../utils/response';
import { siteFromRequest } from '../utils/site';

export class OrderController {
  create = async (req: Request, res: Response): Promise<void> => {
    ok(res, await orderService.create(req.body), 201);
  };
  list = async (req: Request, res: Response): Promise<void> => {
    const kind = req.query.kind as 'PURCHASE' | 'SALE' | undefined;
    ok(res, await orderService.list(kind));
  };
  clients = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await orderService.listClients());
  };
  getById = async (req: Request, res: Response): Promise<void> => {
    ok(res, await orderService.getById(req.params.id));
  };
  update = async (req: Request, res: Response): Promise<void> => {
    ok(res, await orderService.update(req.params.id, req.body));
  };
  receive = async (req: Request, res: Response): Promise<void> => {
    const body = (req.body ?? {}) as { quantity?: number; all?: boolean };
    ok(res, await orderService.receive(req.params.id, siteFromRequest(req), { quantity: body.quantity, all: body.all }));
  };
  remove = async (req: Request, res: Response): Promise<void> => {
    await orderService.remove(req.params.id);
    ok(res, { deleted: true });
  };
}

export const orderController = new OrderController();
