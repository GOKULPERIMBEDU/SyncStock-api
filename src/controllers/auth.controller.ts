import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { AppError } from '../utils/AppError';
import { ok } from '../utils/response';

function requireUser(req: Request) {
  if (!req.user) throw new AppError(401, 'Authentication required');
  return req.user;
}

export class AuthController {
  login = async (req: Request, res: Response): Promise<void> => {
    const result = await authService.login(req.body.email, req.body.password);
    ok(res, result);
  };

  me = async (req: Request, res: Response): Promise<void> => {
    const user = requireUser(req);
    ok(res, await authService.me(user.id));
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    const user = requireUser(req);
    ok(res, await authService.updateProfile(user.id, req.body));
  };

  changePassword = async (req: Request, res: Response): Promise<void> => {
    const user = requireUser(req);
    ok(res, await authService.changePassword(user.id, req.body.currentPassword, req.body.nextPassword));
  };

  forgotPassword = async (req: Request, res: Response): Promise<void> => {
    ok(res, await authService.forgotPassword(req.body.email));
  };

  resetPassword = async (req: Request, res: Response): Promise<void> => {
    ok(res, await authService.resetPassword(req.body.token, req.body.password));
  };

  listUsers = async (_req: Request, res: Response): Promise<void> => {
    ok(res, await authService.listUsers());
  };

  createUser = async (req: Request, res: Response): Promise<void> => {
    ok(res, await authService.createUser(req.body), 201);
  };

  deleteUser = async (req: Request, res: Response): Promise<void> => {
    const actor = requireUser(req);
    ok(res, await authService.deleteUser(req.params.id, actor.id));
  };
}

export const authController = new AuthController();
