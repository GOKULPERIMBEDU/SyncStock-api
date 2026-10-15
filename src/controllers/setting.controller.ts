import type { Request, Response } from 'express';
import { settingService } from '../services/setting.service';
import { ok } from '../utils/response';
import { tenantFromRequest } from '../utils/tenant';

export class SettingController {
  get = async (req: Request, res: Response): Promise<void> => {
    ok(res, await settingService.get(tenantFromRequest(req)));
  };

  update = async (req: Request, res: Response): Promise<void> => {
    ok(res, await settingService.update(tenantFromRequest(req), req.body));
  };

  listWorkspaces = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await settingService.list());
  };

  createWorkspace = async (req: Request, res: Response): Promise<void> => {
    ok(res, await settingService.createWorkspace(req.body), 201);
  };
}

export const settingController = new SettingController();
