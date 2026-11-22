import { Router } from 'express';
import {
  handleAdminGetSubmission,
  handleAdminListSubmissions,
  handleAdminListUsers,
  handleAdminStats,
  handleAdminUpdateSubmissionStatus,
} from '../controllers/adminController.ts';
import { requireAdmin } from '../middleware/auth.ts';

export function createAdminRouter() {
  const router = Router();

  router.use(requireAdmin);

  router.get('/stats', handleAdminStats);
  router.get('/users', handleAdminListUsers);
  router.get('/submissions', handleAdminListSubmissions);
  router.get('/submissions/:id', handleAdminGetSubmission);
  router.patch('/submissions/:id/status', handleAdminUpdateSubmissionStatus);

  return router;
}
