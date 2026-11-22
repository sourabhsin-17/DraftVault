import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { getEnvConfig } from '../config/env.ts';
import { withTransaction } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx']);

const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.jpg': ['image/jpeg', 'image/pjpeg'],
  '.jpeg': ['image/jpeg', 'image/pjpeg'],
  '.png': ['image/png'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip',
    'application/octet-stream',
  ],
};

export function ensureUploadDir(): string {
  const dir = getEnvConfig().uploadDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function resolveUploadPath(storedName: string): string {
  const baseDir = path.resolve(ensureUploadDir());
  const cleanName = path.basename(storedName);
  const resolved = path.resolve(baseDir, cleanName);
  if (!resolved.startsWith(baseDir + path.sep)) {
    throw new AppError(400, 'INVALID_FILE_PATH', 'Invalid file path.');
  }
  return resolved;
}

export function verifyMagicBytes(buffer: Buffer, extension: string): boolean {
  if (buffer.length < 4) return false;
  switch (extension) {
    case '.pdf':
      return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    case '.jpg':
    case '.jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case '.png':
      return (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a
      );
    case '.doc':
      // OLE2 Compound Binary File signature
      return (
        buffer.length >= 8 &&
        buffer[0] === 0xd0 &&
        buffer[1] === 0xcf &&
        buffer[2] === 0x11 &&
        buffer[3] === 0xe0 &&
        buffer[4] === 0xa1 &&
        buffer[5] === 0xb1 &&
        buffer[6] === 0x1a &&
        buffer[7] === 0xe1
      );
    case '.docx':
      // ZIP PK signature
      return buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07);
    default:
      return false;
  }
}

export function removePhysicalFile(storedName: string): void {
  try {
    const filePath = resolveUploadPath(storedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Best-effort cleanup
  }
}

export function removeDraftPhysicalFiles(storedNames: string[]): void {
  for (const name of storedNames) {
    removePhysicalFile(name);
  }
}

export function saveUploadedFileRecord(
  db: DatabaseSync,
  params: {
    userId: string;
    draftId: string;
    stepKey?: string;
    originalName: string;
    mimeType: string;
    tempFilePath: string;
    sizeBytes: number;
    replaceFileId?: string;
  }
) {
  const ext = path.extname(params.originalName).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    fs.rmSync(params.tempFilePath, { force: true });
    throw new AppError(
      400,
      'UNSUPPORTED_FILE_TYPE',
      'Only PDF, JPG, JPEG, PNG, DOC, and DOCX files are permitted.'
    );
  }

  const allowedMimes = ALLOWED_MIME_TYPES[ext] || [];
  if (!allowedMimes.includes(params.mimeType.toLowerCase())) {
    fs.rmSync(params.tempFilePath, { force: true });
    throw new AppError(400, 'INVALID_MIME_TYPE', 'File MIME type does not match its extension.');
  }

  // Read magic header + compute SHA-256 checksum
  const fileBytes = fs.readFileSync(params.tempFilePath);
  if (!verifyMagicBytes(fileBytes, ext)) {
    fs.rmSync(params.tempFilePath, { force: true });
    throw new AppError(
      400,
      'INVALID_FILE_SIGNATURE',
      'File contents do not match the declared file format signature.'
    );
  }

  const draft = db
    .prepare('SELECT id, user_id, status FROM drafts WHERE id = ?')
    .get(params.draftId) as { id: string; user_id: string; status: string } | undefined;

  if (!draft) {
    fs.rmSync(params.tempFilePath, { force: true });
    throw new AppError(404, 'DRAFT_NOT_FOUND', 'Target draft not found.');
  }
  if (draft.user_id !== params.userId) {
    fs.rmSync(params.tempFilePath, { force: true });
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to attach files to this draft.');
  }
  if (draft.status !== 'Draft') {
    fs.rmSync(params.tempFilePath, { force: true });
    throw new AppError(409, 'DRAFT_ALREADY_SUBMITTED', 'Cannot upload files to a submitted application.');
  }

  const storedName = `${crypto.randomUUID()}${ext}`;
  const finalPath = resolveUploadPath(storedName);
  const checksum = crypto.createHash('sha256').update(fileBytes).digest('hex');
  const fileId = crypto.randomUUID();
  const safeOriginalName = path.basename(params.originalName).replace(/[^\w.\- ()]/g, '_').slice(0, 180);
  const now = new Date().toISOString();

  // Move file into private upload directory
  fs.renameSync(params.tempFilePath, finalPath);

  let replacedStoredName: string | null = null;

  try {
    withTransaction(db, () => {
      if (params.replaceFileId) {
        const oldFile = db
          .prepare('SELECT id, stored_name, user_id, draft_id FROM uploaded_files WHERE id = ?')
          .get(params.replaceFileId) as
          | { id: string; stored_name: string; user_id: string; draft_id: string }
          | undefined;
        if (oldFile && oldFile.user_id === params.userId && oldFile.draft_id === params.draftId) {
          replacedStoredName = oldFile.stored_name;
          db.prepare('DELETE FROM uploaded_files WHERE id = ?').run(oldFile.id);
        }
      }

      db.prepare(
        `INSERT INTO uploaded_files (id, user_id, draft_id, step_key, original_name, stored_name, mime_type, extension, size_bytes, checksum_sha256, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        fileId,
        params.userId,
        params.draftId,
        params.stepKey || 'step_4',
        safeOriginalName,
        storedName,
        params.mimeType,
        ext,
        params.sizeBytes,
        checksum,
        now
      );

      db.prepare('UPDATE drafts SET updated_at = ? WHERE id = ?').run(now, params.draftId);
    });
  } catch (err) {
    removePhysicalFile(storedName);
    throw err;
  }

  if (replacedStoredName) {
    removePhysicalFile(replacedStoredName);
  }

  return {
    id: fileId,
    draftId: params.draftId,
    stepKey: params.stepKey || 'step_4',
    originalName: safeOriginalName,
    mimeType: params.mimeType,
    extension: ext,
    sizeBytes: params.sizeBytes,
    createdAt: now,
  };
}

export function listDraftFiles(db: DatabaseSync, draftId: string, userId: string, isAdmin = false) {
  const draft = db.prepare('SELECT id, user_id FROM drafts WHERE id = ?').get(draftId) as
    | { id: string; user_id: string }
    | undefined;
  if (!draft) {
    throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
  }
  if (!isAdmin && draft.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view these files.');
  }

  const rows = db
    .prepare(
      `SELECT id, draft_id, step_key, original_name, mime_type, extension, size_bytes, created_at
       FROM uploaded_files WHERE draft_id = ? ORDER BY created_at DESC`
    )
    .all(draftId) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id,
    draftId: r.draft_id,
    stepKey: r.step_key,
    originalName: r.original_name,
    mimeType: r.mime_type,
    extension: r.extension,
    sizeBytes: Number(r.size_bytes),
    createdAt: r.created_at,
  }));
}

export function deleteUploadedFile(db: DatabaseSync, fileId: string, userId: string) {
  const file = db
    .prepare(
      `SELECT uf.id, uf.user_id, uf.draft_id, uf.stored_name, d.status as draft_status
       FROM uploaded_files uf
       JOIN drafts d ON d.id = uf.draft_id
       WHERE uf.id = ?`
    )
    .get(fileId) as
    | { id: string; user_id: string; draft_id: string; stored_name: string; draft_status: string }
    | undefined;

  if (!file) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
  }
  if (file.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this file.');
  }
  if (file.draft_status !== 'Draft') {
    throw new AppError(409, 'DRAFT_ALREADY_SUBMITTED', 'Files on submitted applications cannot be removed.');
  }

  db.prepare('DELETE FROM uploaded_files WHERE id = ? AND user_id = ?').run(fileId, userId);
  removePhysicalFile(file.stored_name);

  return { deleted: true, id: fileId };
}

export function getAuthorizedFileForDownload(
  db: DatabaseSync,
  fileId: string,
  requester: { id: string; role: 'user' | 'admin' }
) {
  const file = db
    .prepare(
      `SELECT id, user_id, draft_id, original_name, stored_name, mime_type, size_bytes
       FROM uploaded_files WHERE id = ?`
    )
    .get(fileId) as
    | {
        id: string;
        user_id: string;
        draft_id: string;
        original_name: string;
        stored_name: string;
        mime_type: string;
        size_bytes: number;
      }
    | undefined;

  if (!file) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'File not found.');
  }

  if (requester.role !== 'admin' && file.user_id !== requester.id) {
    throw new AppError(403, 'FORBIDDEN', 'You are not authorized to download this file.');
  }

  const filePath = resolveUploadPath(file.stored_name);
  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'FILE_MISSING', 'File data could not be located on storage.');
  }

  return {
    filePath,
    originalName: file.original_name,
    mimeType: file.mime_type,
    sizeBytes: Number(file.size_bytes),
  };
}

export function cleanupOrphanedFiles(db: DatabaseSync, minAgeMs = 24 * 60 * 60 * 1000): number {
  const dir = ensureUploadDir();
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const rows = db.prepare('SELECT stored_name FROM uploaded_files').all() as { stored_name: string }[];
  const known = new Set(rows.map((r) => r.stored_name));
  const cutoff = Date.now() - minAgeMs;

  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // Never touch a file referenced by the database. This also protects uploads
    // that have completed their move but are still being committed by a request.
    if (known.has(entry.name)) continue;
    try {
      const fullPath = path.join(dir, entry.name);
      const stats = fs.statSync(fullPath);
      // Multer's tmp-* files may belong to an active request. Only remove files
      // older than the grace period; apply the same rule to other orphaned files.
      if (stats.mtimeMs > cutoff) continue;
      fs.rmSync(fullPath, { force: true });
      removed++;
    } catch (error) {
      // A file may disappear between readdir/stat/remove; leave other files alone.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn(`Unable to prune abandoned upload ${entry.name}:`, error);
      }
    }
  }
  return removed;
}
