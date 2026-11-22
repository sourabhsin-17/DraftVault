import type { NextFunction, Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import { getEnvConfig } from '../config/env.ts';
import { getSessionAndUser, type SafeUser } from '../services/authService.ts';
import { AppError } from './errorHandler.ts';

declare global {
  namespace Express {
    interface Request {
      db: DatabaseSync;
      user?: SafeUser;
      csrfToken?: string;
      sessionId?: string;
    }
  }
}

export function getCookieOptions(req: Request) {
  const config = getEnvConfig();
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  const isHttps = req.secure || forwardedProto === 'https';

  return {
    httpOnly: true,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    ...(isHttps ? { partitioned: true } : {}),
    path: '/',
    maxAge: config.sessionTtlMs,
  };
}

export function setSessionCookie(req: Request, res: Response, sessionToken: string) {
  const config = getEnvConfig();
  res.cookie(config.sessionCookieName, sessionToken, getCookieOptions(req));
}

export function clearSessionCookie(req: Request, res: Response) {
  const config = getEnvConfig();
  const opts = getCookieOptions(req);
  res.clearCookie(config.sessionCookieName, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    ...(opts.partitioned ? { partitioned: true } : {}),
    path: opts.path,
  });
}

export function attachSession(req: Request, _res: Response, next: NextFunction) {
  const config = getEnvConfig();
  const rawToken = req.cookies?.[config.sessionCookieName] as string | undefined;
  if (rawToken) {
    const resolved = getSessionAndUser(req.db, rawToken);
    if (resolved) {
      req.user = resolved.user;
      req.csrfToken = resolved.csrfToken;
      req.sessionId = resolved.sessionId;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required to access this resource.'));
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication is required.'));
  }
  if (req.user.role !== 'admin') {
    return next(new AppError(403, 'FORBIDDEN', 'Administrator privileges are required.'));
  }
  next();
}
