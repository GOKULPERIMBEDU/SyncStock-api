import type { Request, Response } from 'express';
import { notificationService } from '../services/notification.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/response';

export class NotificationController {
  list = async (req: Request, res: Response): Promise<void> => {
    if (!req.user) throw new AppError(401, 'Authentication required');
    ok(res, await notificationService.list(req.user.id));
  };

  markRead = async (req: Request, res: Response): Promise<void> => {
    ok(res, await notificationService.markRead(req.params.id));
  };
}

export const notificationController = new NotificationController();
