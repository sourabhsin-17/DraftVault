import { Router } from 'express';
import {
  handleDeleteFile,
  handleDownloadFile,
  handleListDraftFiles,
  handleUploadFiles,
} from '../controllers/uploadController.ts';
import { requireAuth } from '../middleware/auth.ts';
import { createUploadMiddleware } from '../middleware/upload.ts';

export function createUploadRouter() {
  const router = Router();
  const upload = createUploadMiddleware();

  router.use(requireAuth);

  router.post('/:draftId', upload.array('files', 5), handleUploadFiles);
  router.get('/:draftId', handleListDraftFiles);
  router.delete('/file/:fileId', handleDeleteFile);
  router.get('/file/:fileId/download', handleDownloadFile);

  return router;
}
