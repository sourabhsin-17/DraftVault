import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../middleware/errorHandler.ts';
import {
  createDraft,
  deleteDraft,
  getDraftByShareToken,
  getDraftDetail,
  listUserDrafts,
  renameDraft,
  resolveDraftConflict,
  updateDraftWithConcurrency,
} from '../services/draftService.ts';
import {
  createDraftSchema,
  renameDraftSchema,
  resolveConflictSchema,
  updateDraftSchema,
} from '../validation/schemas.ts';

export function handleCreateDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createDraftSchema.parse(req.body || {});
    const draft = createDraft(req.db, req.user!.id, parsed.title, parsed.initialData);
    return sendSuccess(res, { draft }, 201);
  } catch (err) {
    next(err);
  }
}

export function handleListDrafts(req: Request, res: Response, next: NextFunction) {
  try {
    const drafts = listUserDrafts(req.db, req.user!.id);
    return sendSuccess(res, { drafts });
  } catch (err) {
    next(err);
  }
}

export function handleGetDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = getDraftDetail(req.db, String(req.params.id), req.user!.id);
    return sendSuccess(res, { draft });
  } catch (err) {
    next(err);
  }
}

export function handleRecoverDraftByToken(req: Request, res: Response, next: NextFunction) {
  try {
    const draft = getDraftByShareToken(req.db, String(req.params.shareToken), req.user!.id);
    return sendSuccess(res, { draft });
  } catch (err) {
    next(err);
  }
}

export function handleUpdateDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateDraftSchema.parse(req.body);
    const updated = updateDraftWithConcurrency(req.db, String(req.params.id), req.user!.id, parsed);
    return sendSuccess(res, { draft: updated });
  } catch (err) {
    next(err);
  }
}

export function handleRenameDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = renameDraftSchema.parse(req.body);
    const draft = renameDraft(req.db, String(req.params.id), req.user!.id, parsed.title);
    return sendSuccess(res, { draft });
  } catch (err) {
    next(err);
  }
}

export function handleDeleteDraft(req: Request, res: Response, next: NextFunction) {
  try {
    const result = deleteDraft(req.db, String(req.params.id), req.user!.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export function handleResolveConflict(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = resolveConflictSchema.parse(req.body);
    const draft = resolveDraftConflict(req.db, String(req.params.id), req.user!.id, parsed);
    return sendSuccess(res, { draft });
  } catch (err) {
    next(err);
  }
}
