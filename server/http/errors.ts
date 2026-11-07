import type { NextFunction, Request, Response } from 'express';

export interface ApiFailure {
  error: string;
  code: string;
  requestId: string;
  details?: Record<string, unknown>;
}

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || (req as unknown as { id?: string }).id || 'req_unknown';
  const response: ApiFailure = {
    error: `Đường dẫn API "${req.method} ${req.path}" không tồn tại.`,
    code: 'NOT_FOUND',
    requestId,
  };
  res.status(404).json(response);
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || (req as unknown as { id?: string }).id || 'req_unknown';

  if (err instanceof AppError) {
    const response: ApiFailure = {
      error: err.message,
      code: err.code,
      requestId,
      details: err.details,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Handle PayloadTooLarge / body-parser 413 error
  if ('type' in err && (err as { type?: string }).type === 'entity.too.large') {
    const response: ApiFailure = {
      error: 'Dung lượng payload vượt quá giới hạn tối đa 1MB.',
      code: 'PAYLOAD_TOO_LARGE',
      requestId,
    };
    res.status(413).json(response);
    return;
  }

  // Generic server error
  console.error(`[ERROR] [${requestId}] ${err.name}: ${err.message}`, err.stack);
  const response: ApiFailure = {
    error: 'Đã xảy ra lỗi máy chủ nội bộ.',
    code: 'INTERNAL_SERVER_ERROR',
    requestId,
  };
  res.status(500).json(response);
}

