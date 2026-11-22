import { Router } from 'express';
import {
  handleCreateDraft,
  handleDeleteDraft,
  handleGetDraft,
  handleListDrafts,
  handleRecoverDraftByToken,
  handleRenameDraft,
  handleResolveConflict,
  handleUpdateDraft,
} from '../controllers/draftController.ts';
import { requireAuth } from '../middleware/auth.ts';

export function createDraftRouter() {
  const router = Router();

  router.use(requireAuth);

  router.post('/', handleCreateDraft);
  router.get('/', handleListDrafts);
  router.get('/recover/:shareToken', handleRecoverDraftByToken);
  router.get('/:id', handleGetDraft);
  router.put('/:id', handleUpdateDraft);
  router.patch('/:id/rename', handleRenameDraft);
  router.delete('/:id', handleDeleteDraft);
  router.post('/:id/resolve-conflict', handleResolveConflict);

  return router;
}
