import type { NextFunction, Request, Response } from 'express';
import { getEnvConfig } from '../config/env.ts';
import { clearSessionCookie, setSessionCookie } from '../middleware/auth.ts';
import { sendSuccess } from '../middleware/errorHandler.ts';
import {
  bootstrapInitialAdmin,
  createPasswordResetRequest,
  deleteSessionByToken,
  getAdminBootstrapStatus,
  loginUser,
  registerUser,
  resetPasswordWithToken,
  updateUserProfile,
} from '../services/authService.ts';
import {
  adminBootstrapSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from '../validation/schemas.ts';

export function handleRegister(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = registerSchema.parse(req.body);
    const config = getEnvConfig();
    const oldToken = req.cookies?.[config.sessionCookieName] as string | undefined;

    const result = registerUser(req.db, parsed, {
      oldSessionToken: oldToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    setSessionCookie(req, res, result.sessionToken);
    return sendSuccess(res, { user: result.user, csrfToken: result.csrfToken }, 201);
  } catch (err) {
    next(err);
  }
}

export function handleLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.parse(req.body);
    const config = getEnvConfig();
    const oldToken = req.cookies?.[config.sessionCookieName] as string | undefined;

    const result = loginUser(req.db, parsed, {
      oldSessionToken: oldToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    setSessionCookie(req, res, result.sessionToken);
    return sendSuccess(res, { user: result.user, csrfToken: result.csrfToken });
  } catch (err) {
    next(err);
  }
}

export function handleAdminLogin(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = loginSchema.parse(req.body);
    const config = getEnvConfig();
    const oldToken = req.cookies?.[config.sessionCookieName] as string | undefined;

    const result = loginUser(req.db, parsed, {
      oldSessionToken: oldToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      requireAdmin: true,
    });

    setSessionCookie(req, res, result.sessionToken);
    return sendSuccess(res, { user: result.user, csrfToken: result.csrfToken });
  } catch (err) {
    next(err);
  }
}

export function handleLogout(req: Request, res: Response, next: NextFunction) {
  try {
    const config = getEnvConfig();
    const token = req.cookies?.[config.sessionCookieName] as string | undefined;
    deleteSessionByToken(req.db, token);
    clearSessionCookie(req, res);
    return sendSuccess(res, { loggedOut: true });
  } catch (err) {
    next(err);
  }
}

export function handleMe(req: Request, res: Response) {
  if (!req.user) {
    return sendSuccess(res, { user: null, csrfToken: null });
  }
  return sendSuccess(res, { user: req.user, csrfToken: req.csrfToken });
}

export function handleUpdateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateProfileSchema.parse(req.body);
    const updatedUser = updateUserProfile(req.db, req.user!.id, parsed);
    return sendSuccess(res, { user: updatedUser });
  } catch (err) {
    next(err);
  }
}

export function handleForgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = forgotPasswordSchema.parse(req.body);
    const result = createPasswordResetRequest(req.db, parsed.email);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export function handleResetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = resetPasswordSchema.parse(req.body);
    const result = resetPasswordWithToken(req.db, parsed.token, parsed.password);
    clearSessionCookie(req, res);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export function handleAdminBootstrapStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const status = getAdminBootstrapStatus(req.db);
    return sendSuccess(res, status);
  } catch (err) {
    next(err);
  }
}

export function handleAdminBootstrap(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = adminBootstrapSchema.parse(req.body);
    const config = getEnvConfig();
    const oldToken = req.cookies?.[config.sessionCookieName] as string | undefined;

    const result = bootstrapInitialAdmin(req.db, parsed, {
      oldSessionToken: oldToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    setSessionCookie(req, res, result.sessionToken);
    return sendSuccess(res, { user: result.user, csrfToken: result.csrfToken }, 201);
  } catch (err) {
    next(err);
  }
}
