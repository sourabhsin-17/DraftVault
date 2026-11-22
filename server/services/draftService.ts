import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { withTransaction } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { removeDraftPhysicalFiles } from './uploadService.ts';

interface DraftRow {
  id: string;
  user_id: string;
  title: string;
  form_type: string;
  current_step: number;
  version: number;
  share_token: string;
  status: 'Draft' | 'Submitted';
  last_client_tab_id: string;
  created_at: string;
  updated_at: string;
}

interface ResponseRow {
  id: string;
  draft_id: string;
  data_json: string;
  completed_steps_json: string;
  updated_at: string;
}

interface VersionRow {
  id: string;
  draft_id: string;
  version: number;
  current_step: number;
  data_json: string;
  saved_by_tab_id: string;
  change_summary: string;
  created_at: string;
}

function safeParseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function serializeDraftSummary(row: DraftRow & { file_count?: number; data_json?: string; completed_steps_json?: string }) {
  const data = row.data_json ? safeParseJson<Record<string, unknown>>(row.data_json, {}) : {};
  const completedSteps = row.completed_steps_json
    ? safeParseJson<number[]>(row.completed_steps_json, [])
    : [];
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    formType: row.form_type,
    currentStep: Number(row.current_step),
    version: Number(row.version),
    shareToken: row.share_token,
    status: row.status,
    lastClientTabId: row.last_client_tab_id || '',
    fileCount: Number(row.file_count ?? 0),
    completedSteps,
    applicantName: typeof data.fullName === 'string' ? data.fullName : '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createDraft(
  db: DatabaseSync,
  userId: string,
  title?: string,
  initialData: Record<string, unknown> = {}
) {
  const draftId = crypto.randomUUID();
  const responseId = crypto.randomUUID();
  const versionId = crypto.randomUUID();
  const shareToken = crypto.randomBytes(18).toString('hex');
  const now = new Date().toISOString();

  // Pre-fill applicant email/name from user profile if not explicitly provided
  const userRow = db
    .prepare('SELECT full_name, email, phone FROM users WHERE id = ?')
    .get(userId) as { full_name: string; email: string; phone: string } | undefined;

  const seededData: Record<string, unknown> = {
    ...(userRow
      ? {
          fullName: userRow.full_name,
          email: userRow.email,
          phone: userRow.phone || '',
        }
      : {}),
    ...initialData,
  };

  const countRow = db
    .prepare('SELECT COUNT(*) as total FROM drafts WHERE user_id = ?')
    .get(userId) as { total: number };
  const draftNumber = Number(countRow.total) + 1;
  const resolvedTitle = title && title.trim().length > 0 ? title.trim() : `Application Draft #${draftNumber}`;
  const dataJson = JSON.stringify(seededData);

  withTransaction(db, () => {
    db.prepare(
      `INSERT INTO drafts (id, user_id, title, form_type, current_step, version, share_token, status, last_client_tab_id, created_at, updated_at)
       VALUES (?, ?, ?, 'standard_application', 1, 1, ?, 'Draft', '', ?, ?)`
    ).run(draftId, userId, resolvedTitle, shareToken, now, now);

    db.prepare(
      `INSERT INTO form_responses (id, draft_id, data_json, completed_steps_json, updated_at)
       VALUES (?, ?, ?, '[]', ?)`
    ).run(responseId, draftId, dataJson, now);

    db.prepare(
      `INSERT INTO draft_versions (id, draft_id, version, current_step, data_json, saved_by_tab_id, change_summary, created_at)
       VALUES (?, ?, 1, 1, ?, '', 'Draft created', ?)`
    ).run(versionId, draftId, dataJson, now);
  });

  return getDraftDetail(db, draftId, userId);
}

export function listUserDrafts(db: DatabaseSync, userId: string) {
  const rows = db
    .prepare(
      `SELECT d.*, fr.data_json, fr.completed_steps_json,
              (SELECT COUNT(*) FROM uploaded_files uf WHERE uf.draft_id = d.id) as file_count
       FROM drafts d
       LEFT JOIN form_responses fr ON fr.draft_id = d.id
       WHERE d.user_id = ?
       ORDER BY d.updated_at DESC`
    )
    .all(userId) as unknown as (DraftRow & {
    file_count: number;
    data_json: string;
    completed_steps_json: string;
  })[];

  return rows.map(serializeDraftSummary);
}

export function getDraftDetail(db: DatabaseSync, draftId: string, userId: string) {
  const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as unknown as DraftRow | undefined;
  if (!draft) {
    throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
  }
  if (draft.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to access this draft.');
  }

  const response = db.prepare('SELECT * FROM form_responses WHERE draft_id = ?').get(draftId) as unknown as
    | ResponseRow
    | undefined;
  const files = db
    .prepare(
      `SELECT id, draft_id, step_key, original_name, mime_type, extension, size_bytes, created_at
       FROM uploaded_files
       WHERE draft_id = ? AND user_id = ?
       ORDER BY created_at DESC`
    )
    .all(draftId, userId) as Record<string, unknown>[];

  const versions = db
    .prepare(
      `SELECT id, version, current_step, saved_by_tab_id, change_summary, created_at
       FROM draft_versions
       WHERE draft_id = ?
       ORDER BY version DESC
       LIMIT 15`
    )
    .all(draftId) as unknown as VersionRow[];

  return {
    id: draft.id,
    userId: draft.user_id,
    title: draft.title,
    formType: draft.form_type,
    currentStep: Number(draft.current_step),
    version: Number(draft.version),
    shareToken: draft.share_token,
    status: draft.status,
    lastClientTabId: draft.last_client_tab_id || '',
    createdAt: draft.created_at,
    updatedAt: draft.updated_at,
    data: response ? safeParseJson<Record<string, unknown>>(response.data_json, {}) : {},
    completedSteps: response ? safeParseJson<number[]>(response.completed_steps_json, []) : [],
    files: files.map((f) => ({
      id: f.id,
      draftId: f.draft_id,
      stepKey: f.step_key,
      originalName: f.original_name,
      mimeType: f.mime_type,
      extension: f.extension,
      sizeBytes: Number(f.size_bytes),
      createdAt: f.created_at,
    })),
    versions: versions.map((v) => ({
      id: v.id,
      version: Number(v.version),
      currentStep: Number(v.current_step),
      savedByTabId: v.saved_by_tab_id || '',
      changeSummary: v.change_summary || '',
      createdAt: v.created_at,
    })),
  };
}

export function getDraftByShareToken(db: DatabaseSync, shareToken: string, userId: string) {
  const draft = db.prepare('SELECT id, user_id FROM drafts WHERE share_token = ?').get(shareToken) as
    | { id: string; user_id: string }
    | undefined;
  if (!draft) {
    throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft recovery link is invalid or draft was deleted.');
  }
  if (draft.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'This draft belongs to a different account.');
  }
  return getDraftDetail(db, draft.id, userId);
}

export function renameDraft(db: DatabaseSync, draftId: string, userId: string, title: string) {
  const draft = db.prepare('SELECT id, user_id, status FROM drafts WHERE id = ?').get(draftId) as
    | { id: string; user_id: string; status: string }
    | undefined;
  if (!draft) {
    throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
  }
  if (draft.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to rename this draft.');
  }
  if (draft.status !== 'Draft') {
    throw new AppError(409, 'DRAFT_SUBMITTED', 'Submitted applications cannot be renamed as drafts.');
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE drafts SET title = ?, updated_at = ? WHERE id = ?').run(title.trim(), now, draftId);
  return getDraftDetail(db, draftId, userId);
}

export function deleteDraft(db: DatabaseSync, draftId: string, userId: string) {
  const draft = db.prepare('SELECT id, user_id, status FROM drafts WHERE id = ?').get(draftId) as
    | { id: string; user_id: string; status: string }
    | undefined;
  if (!draft) {
    throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
  }
  if (draft.user_id !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to delete this draft.');
  }
  if (draft.status === 'Submitted') {
    throw new AppError(409, 'DRAFT_ALREADY_SUBMITTED', 'Submitted applications cannot be deleted.');
  }

  const storedFiles = db
    .prepare('SELECT stored_name FROM uploaded_files WHERE draft_id = ?')
    .all(draftId) as { stored_name: string }[];

  withTransaction(db, () => {
    db.prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?').run(draftId, userId);
  });

  removeDraftPhysicalFiles(storedFiles.map((f) => f.stored_name));
  return { deleted: true, id: draftId };
}

export function updateDraftWithConcurrency(
  db: DatabaseSync,
  draftId: string,
  userId: string,
  input: {
    baseVersion: number;
    currentStep: number;
    data: Record<string, unknown>;
    completedSteps?: number[];
    tabId?: string;
    changeSummary?: string;
  }
) {
  return withTransaction(db, () => {
    const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as unknown as DraftRow | undefined;
    if (!draft) {
      throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
    }
    if (draft.user_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to modify this draft.');
    }
    if (draft.status !== 'Draft') {
      throw new AppError(409, 'DRAFT_ALREADY_SUBMITTED', 'This application has already been submitted and is locked.');
    }

    const response = db.prepare('SELECT * FROM form_responses WHERE draft_id = ?').get(draftId) as unknown as
      | ResponseRow
      | undefined;
    const serverData = response ? safeParseJson<Record<string, unknown>>(response.data_json, {}) : {};
    const serverCompleted = response
      ? safeParseJson<number[]>(response.completed_steps_json, [])
      : [];

    // Optimistic concurrency check: server version must match client's baseVersion
    if (Number(draft.version) !== input.baseVersion) {
      throw new AppError(
        409,
        'VERSION_CONFLICT',
        'A newer version of this draft exists on the server. Resolve the conflict before saving.',
        {
          serverVersion: Number(draft.version),
          serverCurrentStep: Number(draft.current_step),
          serverUpdatedAt: draft.updated_at,
          serverLastTabId: draft.last_client_tab_id || '',
          serverData,
          serverCompletedSteps: serverCompleted,
        }
      );
    }

    const nextVersion = Number(draft.version) + 1;
    const now = new Date().toISOString();
    const mergedData = { ...serverData, ...input.data };
    const nextCompleted = input.completedSteps ?? serverCompleted;
    const dataJson = JSON.stringify(mergedData);
    const completedJson = JSON.stringify([...new Set(nextCompleted)].sort((a, b) => a - b));

    const updateResult = db
      .prepare(
        `UPDATE drafts
         SET version = ?, current_step = ?, last_client_tab_id = ?, updated_at = ?
         WHERE id = ? AND version = ?`
      )
      .run(nextVersion, input.currentStep, input.tabId || '', now, draftId, input.baseVersion);

    if (Number(updateResult.changes) === 0) {
      throw new AppError(409, 'VERSION_CONFLICT', 'Concurrent modification detected while saving.');
    }

    db.prepare(
      `UPDATE form_responses
       SET data_json = ?, completed_steps_json = ?, updated_at = ?
       WHERE draft_id = ?`
    ).run(dataJson, completedJson, now, draftId);

    db.prepare(
      `INSERT INTO draft_versions (id, draft_id, version, current_step, data_json, saved_by_tab_id, change_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      draftId,
      nextVersion,
      input.currentStep,
      dataJson,
      input.tabId || '',
      input.changeSummary || `Autosaved step ${input.currentStep}`,
      now
    );

    return {
      id: draftId,
      version: nextVersion,
      currentStep: input.currentStep,
      data: mergedData,
      completedSteps: safeParseJson<number[]>(completedJson, []),
      updatedAt: now,
    };
  });
}

export function resolveDraftConflict(
  db: DatabaseSync,
  draftId: string,
  userId: string,
  input: {
    resolution: 'use_server' | 'keep_local';
    expectedServerVersion: number;
    currentStep?: number;
    data?: Record<string, unknown>;
    completedSteps?: number[];
    tabId?: string;
  }
) {
  if (input.resolution === 'use_server') {
    return getDraftDetail(db, draftId, userId);
  }

  return withTransaction(db, () => {
    const draft = db.prepare('SELECT * FROM drafts WHERE id = ?').get(draftId) as unknown as DraftRow | undefined;
    if (!draft) {
      throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
    }
    if (draft.user_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to resolve conflicts on this draft.');
    }
    if (draft.status !== 'Draft') {
      throw new AppError(409, 'DRAFT_ALREADY_SUBMITTED', 'This application has already been submitted.');
    }

    if (Number(draft.version) !== input.expectedServerVersion) {
      const response = db.prepare('SELECT * FROM form_responses WHERE draft_id = ?').get(draftId) as unknown as
        | ResponseRow
        | undefined;
      throw new AppError(
        409,
        'VERSION_CONFLICT',
        'Another update arrived while resolving the conflict. Please review the latest server version.',
        {
          serverVersion: Number(draft.version),
          serverCurrentStep: Number(draft.current_step),
          serverUpdatedAt: draft.updated_at,
          serverLastTabId: draft.last_client_tab_id || '',
          serverData: response ? safeParseJson<Record<string, unknown>>(response.data_json, {}) : {},
          serverCompletedSteps: response
            ? safeParseJson<number[]>(response.completed_steps_json, [])
            : [],
        }
      );
    }

    const nextVersion = Number(draft.version) + 1;
    const now = new Date().toISOString();
    const nextStep = input.currentStep ?? Number(draft.current_step);
    const dataJson = JSON.stringify(input.data || {});
    const completedJson = JSON.stringify([...new Set(input.completedSteps || [])].sort((a, b) => a - b));

    db.prepare(
      `UPDATE drafts SET version = ?, current_step = ?, last_client_tab_id = ?, updated_at = ? WHERE id = ?`
    ).run(nextVersion, nextStep, input.tabId || '', now, draftId);

    db.prepare(
      `UPDATE form_responses SET data_json = ?, completed_steps_json = ?, updated_at = ? WHERE draft_id = ?`
    ).run(dataJson, completedJson, now, draftId);

    db.prepare(
      `INSERT INTO draft_versions (id, draft_id, version, current_step, data_json, saved_by_tab_id, change_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Conflict resolved: kept local changes', ?)`
    ).run(crypto.randomUUID(), draftId, nextVersion, nextStep, dataJson, input.tabId || '', now);

    return getDraftDetail(db, draftId, userId);
  });
}
