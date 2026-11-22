import crypto from 'node:crypto';
import path from 'node:path';
import multer from 'multer';
import { getEnvConfig } from '../config/env.ts';
import { ensureUploadDir } from '../services/uploadService.ts';
import { AppError } from './errorHandler.ts';

const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']);

export function createUploadMiddleware() {
  const config = getEnvConfig();
  const uploadDir = ensureUploadDir();

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `tmp-${crypto.randomUUID()}${ext}`);
    },
  });

  return multer({
    storage,
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: 5,
    },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_EXT.has(ext)) {
        return cb(
          new AppError(
            400,
            'UNSUPPORTED_FILE_TYPE',
            'Only PDF, JPG, JPEG, PNG, DOC, and DOCX files are permitted.'
          )
        );
      }
      cb(null, true);
    },
  });
}
