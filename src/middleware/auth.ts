import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../models/User';
import { AppError } from '../utils/AppError';

interface TokenPayload {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export function protect(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    next(new AppError(401, 'Authentication required'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as TokenPayload;
    req.user = {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, 'Authentication required'));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError(403, 'You do not have permission for this action'));
      return;
    }
    next();
  };
}
