import type { Request, Response } from 'express';
import { warehouseService } from '../services/warehouse.service';
import { ok } from '../utils/response';

export class WarehouseController {
  overview = async (req: Request, res: Response): Promise<void> => {
    const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : undefined;
    const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
    ok(res, await warehouseService.getOverview(siteId, scope));
  };

  materials = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await warehouseService.getMaterials());
  };

  shipments = async (req: Request, res: Response): Promise<void> => {
    const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : undefined;
    ok(res, await warehouseService.getShipments(siteId));
  };

  advanceShipment = async (req: Request, res: Response): Promise<void> => {
    ok(res, await warehouseService.advanceShipment(req.params.code.toUpperCase()));
  };

  reseed = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await warehouseService.reseed(), 201);
  };
}

export const warehouseController = new WarehouseController();
