import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/AppError.js';

type RequestPart = 'body' | 'query' | 'params';

declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
    }
  }
}

export function validate(schema: ZodType, part: RequestPart = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      return next(AppError.validation('Validation failed', result.error.flatten()));
    }

    // Express 5: req.query / req.params are getters — do not reassign them.
    if (part === 'body') {
      req.body = result.data;
    } else {
      req.validated = { ...(req.validated ?? {}), [part]: result.data };
    }

    return next();
  };
}
