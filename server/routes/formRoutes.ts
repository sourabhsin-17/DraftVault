import { Router } from 'express';
import {
  handleGetFormConfig,
  handleGetUserSubmission,
  handleBeginSubmissionRevision,
  handleListUserSubmissions,
  handleSaveStep,
  handleSubmitApplication,
  handleValidateStep,
} from '../controllers/formController.ts';
import { requireAuth } from '../middleware/auth.ts';

export function createFormRouter() {
  const router = Router();

  router.get('/config', handleGetFormConfig);

  router.use(requireAuth);
  router.post('/validate-step', handleValidateStep);
  router.post('/:draftId/save-step', handleSaveStep);
  router.post('/submit', handleSubmitApplication);
  router.post('/submissions/:id/revise', handleBeginSubmissionRevision);
  router.get('/submissions', handleListUserSubmissions);
  router.get('/submissions/:id', handleGetUserSubmission);

  return router;
}
