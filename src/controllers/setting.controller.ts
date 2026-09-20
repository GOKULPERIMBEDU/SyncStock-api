import type { Request, Response } from 'express';
import { settingService } from '../services/setting.service';
import { ok } from '../utils/response';

export class SettingController {
  get = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await settingService.get());
  };

  update = async (req: Request, res: Response): Promise<void> => {
    ok(res, await settingService.update(req.body));
  };
}

export const settingController = new SettingController();
