import type { NextFunction, Request, Response } from 'express';
import { sendSuccess } from '../middleware/errorHandler.ts';
import {
  getAdminStats,
  listAllSubmissions,
  listAllUsers,
  updateSubmissionStatus,
} from '../services/adminService.ts';
import { getSubmissionDetail } from '../services/submissionService.ts';
import { updateSubmissionStatusSchema } from '../validation/schemas.ts';

export function handleAdminStats(req: Request, res: Response, next: NextFunction) {
  try {
    const stats = getAdminStats(req.db);
    return sendSuccess(res, { stats });
  } catch (err) {
    next(err);
  }
}

export function handleAdminListUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const users = listAllUsers(req.db, search);
    return sendSuccess(res, { users });
  } catch (err) {
    next(err);
  }
}

export function handleAdminListSubmissions(req: Request, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const submissions = listAllSubmissions(req.db, { search, status });
    return sendSuccess(res, { submissions });
  } catch (err) {
    next(err);
  }
}

export function handleAdminGetSubmission(req: Request, res: Response, next: NextFunction) {
  try {
    const submission = getSubmissionDetail(req.db, String(req.params.id), {
      id: req.user!.id,
      role: 'admin',
    });
    return sendSuccess(res, { submission });
  } catch (err) {
    next(err);
  }
}

export function handleAdminUpdateSubmissionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = updateSubmissionStatusSchema.parse(req.body);
    const submission = updateSubmissionStatus(req.db, String(req.params.id), req.user!.id, parsed);
    return sendSuccess(res, { submission });
  } catch (err) {
    next(err);
  }
}
