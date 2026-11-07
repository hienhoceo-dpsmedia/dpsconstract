import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errors.js';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    userId?: string;
    authVersion?: number;
    loginAt?: number;
    lastActivity?: number;
  }
}

export function generateCsrfToken(req: Request): string {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

export function verifyCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not require CSRF token
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Exempt webhooks from session-based CSRF
  const url = req.originalUrl || req.url || req.path;
  if (url.includes('/api/webhooks/')) {
    return next();
  }

  // Allow login endpoint when session CSRF token has not been issued yet
  if (url.includes('/api/auth/login') && !req.session?.csrfToken) {
    return next();
  }

  const tokenFromHeader = (req.headers['x-csrf-token'] as string) || (req.headers['x-xsrf-token'] as string);
  const sessionToken = req.session?.csrfToken;

  if (!tokenFromHeader || !sessionToken || tokenFromHeader !== sessionToken) {
    return next(new AppError(403, 'CSRF_INVALID', 'Mã xác thực CSRF không hợp lệ hoặc đã hết hạn.'));
  }

  next();
}
