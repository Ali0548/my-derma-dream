import type { Response } from 'express';
import { HttpStatus } from '../errors/errorCodes.js';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = HttpStatus.OK,
  meta?: Record<string, unknown>,
) {
  return res.status(statusCode).json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}
