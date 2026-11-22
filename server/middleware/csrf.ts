import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './errorHandler.ts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function verifyOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    return true;
  }
  try {
    const parsedOrigin = new URL(origin);
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const requestHost = forwardedHost || req.get('host') || '';
    if (!requestHost) return true;
    return parsedOrigin.host === requestHost;
  } catch {
    return false;
  }
}

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  if (!verifyOrigin(req)) {
    return next(new AppError(403, 'CSRF_ORIGIN_MISMATCH', 'Cross-origin request rejected.'));
  }

  // If user has an authenticated session cookie, require matching X-CSRF-Token header
  if (req.user && req.csrfToken) {
    const provided = String(req.headers['x-csrf-token'] || '');
    const expectedBuf = Buffer.from(req.csrfToken, 'utf8');
    const providedBuf = Buffer.from(provided, 'utf8');

    if (
      provided.length === 0 ||
      expectedBuf.length !== providedBuf.length ||
      !crypto.timingSafeEqual(expectedBuf, providedBuf)
    ) {
      return next(new AppError(403, 'INVALID_CSRF_TOKEN', 'Missing or invalid CSRF token.'));
    }
  }

  next();
}
