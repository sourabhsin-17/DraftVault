import fs from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import { AppError, sendSuccess } from '../middleware/errorHandler.ts';
import {
  deleteUploadedFile,
  getAuthorizedFileForDownload,
  listDraftFiles,
  saveUploadedFileRecord,
} from '../services/uploadService.ts';

export function handleUploadFiles(req: Request, res: Response, next: NextFunction) {
  const uploadedMulterFiles = (req.files as Express.Multer.File[] | undefined) || [];
  try {
    if (uploadedMulterFiles.length === 0) {
      throw new AppError(400, 'NO_FILES_PROVIDED', 'Please select at least one valid file to upload.');
    }

    const draftId = String(req.params.draftId);
    const stepKey = typeof req.body?.stepKey === 'string' ? req.body.stepKey : 'step_4';
    const replaceFileId = typeof req.body?.replaceFileId === 'string' ? req.body.replaceFileId : undefined;

    const savedFiles = [];
    for (let i = 0; i < uploadedMulterFiles.length; i++) {
      const f = uploadedMulterFiles[i]!;
      const saved = saveUploadedFileRecord(req.db, {
        userId: req.user!.id,
        draftId,
        stepKey,
        originalName: f.originalname,
        mimeType: f.mimetype,
        tempFilePath: f.path,
        sizeBytes: f.size,
        replaceFileId: i === 0 ? replaceFileId : undefined,
      });
      savedFiles.push(saved);
    }

    return sendSuccess(res, { files: savedFiles }, 201);
  } catch (err) {
    // Clean up any remaining temporary files if an error occurred partway through
    for (const f of uploadedMulterFiles) {
      if (f.path && fs.existsSync(f.path)) {
        fs.rmSync(f.path, { force: true });
      }
    }
    next(err);
  }
}

export function handleListDraftFiles(req: Request, res: Response, next: NextFunction) {
  try {
    const files = listDraftFiles(
      req.db,
      String(req.params.draftId),
      req.user!.id,
      req.user!.role === 'admin'
    );
    return sendSuccess(res, { files });
  } catch (err) {
    next(err);
  }
}

export function handleDeleteFile(req: Request, res: Response, next: NextFunction) {
  try {
    const result = deleteUploadedFile(req.db, String(req.params.fileId), req.user!.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export function handleDownloadFile(req: Request, res: Response, next: NextFunction) {
  try {
    const fileInfo = getAuthorizedFileForDownload(req.db, String(req.params.fileId), {
      id: req.user!.id,
      role: req.user!.role,
    });

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Content-Type', fileInfo.mimeType);
    const safeFilename = encodeURIComponent(fileInfo.originalName);
    const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${safeFilename}`);
    return res.sendFile(fileInfo.filePath);
  } catch (err) {
    next(err);
  }
}
