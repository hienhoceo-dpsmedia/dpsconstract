import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

const REDACTED_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'api_key',
  'apikey',
  'gemini_api_key',
  'session_secret',
]);

export function redactSensitiveData(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'] as string;
  req.id = incomingId && incomingId.trim() !== '' ? incomingId : crypto.randomUUID();
  req.startTime = Date.now();
  res.setHeader('X-Request-Id', req.id);

  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    // Log info without leaking sensitive body/headers
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] [${req.id}] ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${duration}ms`);
    }
  });

  next();
}

