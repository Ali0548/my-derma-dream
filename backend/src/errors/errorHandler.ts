import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from './AppError.js';
import { ErrorCodes, HttpStatus } from './errorCodes.js';
import { env } from '../config/env.js';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? null,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(HttpStatus.UNPROCESSABLE).json({
      success: false,
      error: {
        code: ErrorCodes.VALIDATION_ERROR,
        message: 'Validation failed',
        details: err.flatten(),
      },
    });
  }

  console.error('[unhandled]', err);

  return res.status(HttpStatus.INTERNAL_ERROR).json({
    success: false,
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: env.NODE_ENV === 'production' ? 'Something went wrong' : String(err),
      details: null,
    },
  });
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(HttpStatus.NOT_FOUND).json({
    success: false,
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: 'Route not found',
      details: null,
    },
  });
}
