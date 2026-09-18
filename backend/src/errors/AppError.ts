import { ErrorCode, ErrorCodes, HttpStatus } from './errorCodes.js';

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_ERROR,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(message, HttpStatus.BAD_REQUEST, ErrorCodes.BAD_REQUEST, details);
  }

  static validation(message: string, details?: unknown) {
    return new AppError(message, HttpStatus.UNPROCESSABLE, ErrorCodes.VALIDATION_ERROR, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new AppError(message, HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(message, HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }

  static notFound(message = 'Resource not found') {
    return new AppError(message, HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  static conflict(message: string, details?: unknown) {
    return new AppError(message, HttpStatus.CONFLICT, ErrorCodes.CONFLICT, details);
  }
}
