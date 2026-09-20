import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/AppError';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details,
    });
    return;
  }

  if (isMongoError(err) && err.code === 11000) {
    res.status(409).json({
      success: false,
      message: 'A record with that unique value already exists.',
      details: err.keyValue,
    });
    return;
  }

  if (isNamedError(err) && err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (isNamedError(err) && err.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid identifier format.',
    });
    return;
  }

  console.error('[error]', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

function isMongoError(err: unknown): err is { code: number; keyValue?: unknown } {
  return typeof err === 'object' && err !== null && 'code' in err;
}

function isNamedError(err: unknown): err is { name: string; message: string } {
  return typeof err === 'object' && err !== null && 'name' in err && 'message' in err;
}
