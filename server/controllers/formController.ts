import type { NextFunction, Request, Response } from 'express';
import { APPLICATION_FORM_STEPS, validateStepData } from '../config/formSchema.ts';
import { AppError, sendSuccess } from '../middleware/errorHandler.ts';
import { updateDraftWithConcurrency } from '../services/draftService.ts';
import {
  beginSubmissionRevision,
  getSubmissionDetail,
  listUserSubmissions,
  submitApplication,
} from '../services/submissionService.ts';
import {
  saveStepRequestSchema,
  submitApplicationSchema,
  validateStepRequestSchema,
} from '../validation/schemas.ts';

export function handleGetFormConfig(_req: Request, res: Response) {
  return sendSuccess(res, {
    formId: 'standard_application',
    title: 'Multi-Step Application Form',
    totalSteps: APPLICATION_FORM_STEPS.length,
    steps: APPLICATION_FORM_STEPS,
  });
}

export function handleValidateStep(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = validateStepRequestSchema.parse(req.body);
    const validation = validateStepData(parsed.stepNumber, parsed.data);
    if (!validation) {
      throw new AppError(400, 'INVALID_STEP', 'Unknown form step.');
    }

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'STEP_VALIDATION_FAILED',
          message: validation.error.issues[0]?.message || 'Please complete required fields.',
          details: { fieldErrors },
        },
      });
    }

    return sendSuccess(res, { valid: true, stepNumber: parsed.stepNumber });
  } catch (err) {
    next(err);
  }
}

export function handleSaveStep(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = saveStepRequestSchema.parse(req.body);
    const validation = validateStepData(parsed.stepNumber, parsed.data);
    if (!validation) {
      throw new AppError(400, 'INVALID_STEP', 'Unknown form step.');
    }

    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        const key = issue.path.join('.') || 'form';
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      return res.status(400).json({
        success: false,
        error: {
          code: 'STEP_VALIDATION_FAILED',
          message: validation.error.issues[0]?.message || 'Please complete required fields.',
          details: { fieldErrors },
        },
      });
    }

    const completedSet = new Set(parsed.completedSteps || []);
    completedSet.add(parsed.stepNumber);

    const updated = updateDraftWithConcurrency(req.db, String(req.params.draftId), req.user!.id, {
      baseVersion: parsed.baseVersion,
      currentStep: parsed.nextStep ?? Math.min(5, parsed.stepNumber + 1),
      data: parsed.data,
      completedSteps: [...completedSet],
      tabId: parsed.tabId,
      changeSummary: `Completed step ${parsed.stepNumber}`,
    });

    return sendSuccess(res, { draft: updated });
  } catch (err) {
    next(err);
  }
}

export function handleSubmitApplication(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = submitApplicationSchema.parse(req.body);
    const submission = submitApplication(req.db, req.user!.id, parsed);
    return sendSuccess(res, { submission }, 201);
  } catch (err) {
    next(err);
  }
}


export function handleBeginSubmissionRevision(req: Request, res: Response, next: NextFunction) {
  try {
    const result = beginSubmissionRevision(req.db, String(req.params.id), req.user!.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export function handleListUserSubmissions(req: Request, res: Response, next: NextFunction) {
  try {
    const submissions = listUserSubmissions(req.db, req.user!.id);
    return sendSuccess(res, { submissions });
  } catch (err) {
    next(err);
  }
}

export function handleGetUserSubmission(req: Request, res: Response, next: NextFunction) {
  try {
    const submission = getSubmissionDetail(req.db, String(req.params.id), {
      id: req.user!.id,
      role: req.user!.role,
    });
    return sendSuccess(res, { submission });
  } catch (err) {
    next(err);
  }
}
