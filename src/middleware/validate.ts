import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';
import { AppError } from '../utils/AppError';

export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!parsed.success) {
      const details = parsed.error.flatten();
      next(new AppError(400, 'Validation failed', details));
      return;
    }

    const data = parsed.data as {
      body?: Record<string, unknown>;
      params?: Record<string, unknown>;
      query?: Record<string, unknown>;
    };

    if (data.body) req.body = data.body;
    if (data.params) req.params = data.params as Request['params'];
    if (data.query) req.query = data.query as Request['query'];

    next();
  };
}
