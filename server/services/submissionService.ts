import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { fullApplicationSchema } from '../config/formSchema.ts';
import { withTransaction } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';

function generateReferenceCode(): string {
  const year = new Date().getUTCFullYear();
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `APP-${year}-${randomSuffix}`;
}

export function submitApplication(
  db: DatabaseSync,
  userId: string,
  input: { draftId: string; baseVersion?: number; data: Record<string, unknown> }
) {
  // Validate full 5-step payload
  const parsed = fullApplicationSchema.safeParse(input.data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || 'form';
      if (!fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    throw new AppError(400, 'VALIDATION_ERROR', 'Please complete all required application fields before submitting.', {
      fieldErrors,
    });
  }

  return withTransaction(db, () => {
    const draft = db
      .prepare('SELECT id, user_id, title, version, status FROM drafts WHERE id = ?')
      .get(input.draftId) as
      | { id: string; user_id: string; title: string; version: number; status: string }
      | undefined;

    if (!draft) {
      throw new AppError(404, 'DRAFT_NOT_FOUND', 'Draft not found.');
    }
    if (draft.user_id !== userId) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have permission to submit this application.');
    }

    const existingSubmission = db
      .prepare('SELECT id, reference_code FROM submissions WHERE draft_id = ?')
      .get(input.draftId) as { id: string; reference_code: string } | undefined;

    if (draft.status !== 'Draft') {
      if (existingSubmission) {
        throw new AppError(
          409,
          'DUPLICATE_SUBMISSION',
          'This application has already been submitted. Open Edit Application to make a revision.'
        );
      }
      throw new AppError(
        409,
        'DRAFT_NOT_EDITABLE',
        'This draft is not editable.'
      );
    }

    if (input.baseVersion !== undefined && Number(draft.version) !== input.baseVersion) {
      throw new AppError(
        409,
        'VERSION_CONFLICT',
        'Your draft version is out of date. Please sync the latest draft changes before submitting.',
        { serverVersion: Number(draft.version) }
      );
    }

    const files = db
      .prepare(
        `SELECT id, original_name, mime_type, extension, size_bytes, created_at
         FROM uploaded_files WHERE draft_id = ? ORDER BY created_at ASC`
      )
      .all(input.draftId) as Record<string, unknown>[];

    const now = new Date().toISOString();
    const submissionId = crypto.randomUUID();
    const referenceCode = generateReferenceCode();
    const nextVersion = Number(draft.version) + 1;

    const snapshot = {
      formData: parsed.data,
      files: files.map((f) => ({
        id: f.id,
        originalName: f.original_name,
        mimeType: f.mime_type,
        extension: f.extension,
        sizeBytes: Number(f.size_bytes),
        createdAt: f.created_at,
      })),
    };

    const snapshotJson = JSON.stringify(snapshot);
    const dataJson = JSON.stringify(parsed.data);

    db.prepare(
      `UPDATE drafts SET status = 'Submitted', current_step = 5, version = ?, updated_at = ? WHERE id = ?`
    ).run(nextVersion, now, input.draftId);

    db.prepare(
      `UPDATE form_responses SET data_json = ?, completed_steps_json = '[1,2,3,4,5]', updated_at = ? WHERE draft_id = ?`
    ).run(dataJson, now, input.draftId);

    db.prepare(
      `INSERT INTO draft_versions (id, draft_id, version, current_step, data_json, saved_by_tab_id, change_summary, created_at)
       VALUES (?, ?, ?, 5, ?, '', 'Final application submitted', ?)`
    ).run(crypto.randomUUID(), input.draftId, nextVersion, dataJson, now);

    let finalSubmissionId: string = submissionId;
    let finalReferenceCode = referenceCode;
    let previousStatus: string | null = null;
    if (existingSubmission) {
      const existing = db.prepare('SELECT id, reference_code, status FROM submissions WHERE id = ?').get(existingSubmission.id) as
        | { id: string; reference_code: string; status: string }
        | undefined;
      if (!existing) throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Original submission was not found.');
      finalSubmissionId = existing.id;
      finalReferenceCode = existing.reference_code;
      previousStatus = existing.status;
      db.prepare(
        `UPDATE submissions SET title = ?, applicant_name = ?, applicant_email = ?, snapshot_json = ?, status = 'Submitted', submitted_at = ?, updated_at = ? WHERE id = ? AND user_id = ?`
      ).run(draft.title, parsed.data.fullName, parsed.data.email, snapshotJson, now, now, existing.id, userId);
    } else {
      db.prepare(
        `INSERT INTO submissions (id, reference_code, draft_id, user_id, title, applicant_name, applicant_email, snapshot_json, status, admin_notes, submitted_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', '', ?, ?)`
      ).run(submissionId, referenceCode, input.draftId, userId, draft.title, parsed.data.fullName, parsed.data.email, snapshotJson, now, now);
    }

    db.prepare(
      `INSERT INTO application_status_history (id, submission_id, previous_status, new_status, changed_by_user_id, note, created_at)
       VALUES (?, ?, ?, 'Submitted', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      finalSubmissionId,
      previousStatus,
      userId,
      existingSubmission ? 'Applicant revised and resubmitted the application' : 'Application submitted by applicant',
      now
    );

    return {
      id: finalSubmissionId,
      referenceCode: finalReferenceCode,
      draftId: input.draftId,
      title: draft.title,
      status: 'Submitted',
      submittedAt: now,
      revised: Boolean(existingSubmission),
    };
  });
}

export function beginSubmissionRevision(db: DatabaseSync, submissionId: string, userId: string) {
  return withTransaction(db, () => {
    const submission = db.prepare('SELECT id, draft_id, user_id, status FROM submissions WHERE id = ?').get(submissionId) as
      | { id: string; draft_id: string; user_id: string; status: string }
      | undefined;
    if (!submission) throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Submitted application not found.');
    if (submission.user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'You can only edit your own application.');

    const draft = db.prepare('SELECT id, status, version FROM drafts WHERE id = ?').get(submission.draft_id) as
      | { id: string; status: string; version: number }
      | undefined;
    if (!draft) throw new AppError(404, 'DRAFT_NOT_FOUND', 'The original application data is unavailable.');
    if (draft.status === 'Draft') {
      return { draftId: draft.id, alreadyEditing: true };
    }

    const response = db.prepare('SELECT data_json FROM form_responses WHERE draft_id = ?').get(draft.id) as
      | { data_json: string }
      | undefined;
    const dataJson = response?.data_json || '{}';
    const now = new Date().toISOString();
    const nextVersion = Number(draft.version) + 1;
    db.prepare("UPDATE drafts SET status = 'Draft', current_step = 1, version = ?, updated_at = ? WHERE id = ?")
      .run(nextVersion, now, draft.id);
    db.prepare(
      `INSERT INTO draft_versions (id, draft_id, version, current_step, data_json, saved_by_tab_id, change_summary, created_at)
       VALUES (?, ?, ?, 1, ?, '', 'Applicant opened submitted application for revision', ?)`
    ).run(crypto.randomUUID(), draft.id, nextVersion, dataJson, now);
    return { draftId: draft.id, alreadyEditing: false };
  });
}

export function listUserSubmissions(db: DatabaseSync, userId: string) {
  const rows = db
    .prepare(
      `SELECT id, reference_code, draft_id, user_id, title, applicant_name, applicant_email, status, submitted_at, updated_at
       FROM submissions
       WHERE user_id = ?
       ORDER BY submitted_at DESC`
    )
    .all(userId) as Record<string, unknown>[];

  return rows.map((r) => ({
    id: r.id,
    referenceCode: r.reference_code,
    draftId: r.draft_id,
    userId: r.user_id,
    title: r.title,
    applicantName: r.applicant_name,
    applicantEmail: r.applicant_email,
    status: r.status,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
  }));
}

export function getSubmissionDetail(
  db: DatabaseSync,
  submissionId: string,
  requester: { id: string; role: 'user' | 'admin' }
) {
  const row = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId) as
    | Record<string, unknown>
    | undefined;
  if (!row) {
    throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Submitted application not found.');
  }
  if (requester.role !== 'admin' && row.user_id !== requester.id) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this application.');
  }

  const history = db
    .prepare(
      `SELECT h.id, h.previous_status, h.new_status, h.note, h.created_at, u.full_name as changed_by_name, u.role as changed_by_role
       FROM application_status_history h
       LEFT JOIN users u ON u.id = h.changed_by_user_id
       WHERE h.submission_id = ?
       ORDER BY h.created_at ASC`
    )
    .all(submissionId) as Record<string, unknown>[];

  let snapshot = { formData: {}, files: [] as unknown[] };
  try {
    snapshot = JSON.parse(String(row.snapshot_json || '{}'));
  } catch {
    // fallback
  }

  return {
    id: row.id,
    referenceCode: row.reference_code,
    draftId: row.draft_id,
    userId: row.user_id,
    title: row.title,
    applicantName: row.applicant_name,
    applicantEmail: row.applicant_email,
    status: row.status,
    adminNotes: row.admin_notes || '',
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
    formData: snapshot.formData || {},
    files: snapshot.files || [],
    statusHistory: history.map((h) => ({
      id: h.id,
      previousStatus: h.previous_status,
      newStatus: h.new_status,
      note: h.note || '',
      changedByName: h.changed_by_name || 'System',
      changedByRole: h.changed_by_role || 'user',
      createdAt: h.created_at,
    })),
  };
}
