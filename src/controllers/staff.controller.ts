import type { Request, Response } from 'express';
import { staffService } from '../services/staff.service';
import { ok } from '../utils/response';

export class StaffController {
  create = async (req: Request, res: Response): Promise<void> => {
    ok(res, await staffService.create(req.body), 201);
  };
  list = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await staffService.list());
  };
  getById = async (req: Request, res: Response): Promise<void> => {
    ok(res, await staffService.getById(req.params.id));
  };
  update = async (req: Request, res: Response): Promise<void> => {
    ok(res, await staffService.update(req.params.id, req.body));
  };
  remove = async (req: Request, res: Response): Promise<void> => {
    await staffService.remove(req.params.id);
    ok(res, { deleted: true });
  };
}

export const staffController = new StaffController();
