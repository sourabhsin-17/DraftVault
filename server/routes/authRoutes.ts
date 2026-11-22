import { Router } from 'express';
import {
  handleAdminBootstrap,
  handleAdminBootstrapStatus,
  handleAdminLogin,
  handleForgotPassword,
  handleLogin,
  handleLogout,
  handleMe,
  handleRegister,
  handleResetPassword,
  handleUpdateProfile,
} from '../controllers/authController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';

export function createAuthRouter(options?: { disableRateLimit?: boolean }) {
  const router = Router();
  const noop = (_req: unknown, _res: unknown, next: () => void) => next();

  const authRateLimiter = options?.disableRateLimit
    ? noop
    : createRateLimiter({ windowMs: 5 * 60 * 1000, maxRequests: 25, keyPrefix: 'auth' });

  const resetRateLimiter = options?.disableRateLimit
    ? noop
    : createRateLimiter({ windowMs: 10 * 60 * 1000, maxRequests: 10, keyPrefix: 'reset' });

  router.post('/register', authRateLimiter, handleRegister);
  router.post('/login', authRateLimiter, handleLogin);
  router.post('/logout', handleLogout);
  router.get('/me', handleMe);
  router.patch('/profile', requireAuth, handleUpdateProfile);
  router.post('/forgot-password', resetRateLimiter, handleForgotPassword);
  router.post('/reset-password', resetRateLimiter, handleResetPassword);

  router.get('/admin/bootstrap-status', handleAdminBootstrapStatus);
  router.post('/admin/bootstrap', authRateLimiter, handleAdminBootstrap);
  router.post('/admin/login', authRateLimiter, handleAdminLogin);

  return router;
}
