import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { ok } from '../utils/response';

export class DashboardController {
  summary = async (_req: Request, res: Response): Promise<void> => {
    const summary = await dashboardService.getSummary();
    ok(res, summary);
  };
}

export const dashboardController = new DashboardController();
