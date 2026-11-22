import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { withTransaction } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';
import { getSubmissionDetail } from './submissionService.ts';

export function getAdminStats(db: DatabaseSync) {
  const userStats = db
    .prepare("SELECT COUNT(*) as total FROM users WHERE role = 'user'")
    .get() as { total: number };
  const draftStats = db
    .prepare("SELECT COUNT(*) as total FROM drafts WHERE status = 'Draft'")
    .get() as { total: number };
  const fileStats = db
    .prepare('SELECT COUNT(*) as total, COALESCE(SUM(size_bytes), 0) as total_bytes FROM uploaded_files')
    .get() as { total: number; total_bytes: number };

  const statusRows = db
    .prepare('SELECT status, COUNT(*) as count FROM submissions GROUP BY status')
    .all() as { status: string; count: number }[];

  const statusBreakdown: Record<string, number> = {
    Submitted: 0,
    'Under Review': 0,
    Approved: 0,
    Rejected: 0,
  };
  let totalSubmissions = 0;
  for (const row of statusRows) {
    statusBreakdown[row.status] = Number(row.count);
    totalSubmissions += Number(row.count);
  }

  const recentSubmissions = db
    .prepare(
      `SELECT id, reference_code, title, applicant_name, applicant_email, status, submitted_at
       FROM submissions
       ORDER BY submitted_at DESC
       LIMIT 6`
    )
    .all() as Record<string, unknown>[];

  return {
    totalUsers: Number(userStats.total),
    activeDrafts: Number(draftStats.total),
    totalSubmissions,
    totalFiles: Number(fileStats.total),
    totalStorageBytes: Number(fileStats.total_bytes),
    statusBreakdown,
    recentSubmissions: recentSubmissions.map((s) => ({
      id: s.id,
      referenceCode: s.reference_code,
      title: s.title,
      applicantName: s.applicant_name,
      applicantEmail: s.applicant_email,
      status: s.status,
      submittedAt: s.submitted_at,
    })),
  };
}

export function listAllUsers(db: DatabaseSync, search?: string) {
  const query = search ? `%${search.trim().toLowerCase()}%` : null;
  const rows = query
    ? (db
        .prepare(
          `SELECT u.id, u.email, u.full_name, u.role, u.phone, u.created_at,
                  (SELECT COUNT(*) FROM drafts d WHERE d.user_id = u.id AND d.status = 'Draft') as draft_count,
                  (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.id) as submission_count
           FROM users u
           WHERE LOWER(u.email) LIKE ? OR LOWER(u.full_name) LIKE ?
           ORDER BY u.created_at DESC`
        )
        .all(query, query) as Record<string, unknown>[])
    : (db
        .prepare(
          `SELECT u.id, u.email, u.full_name, u.role, u.phone, u.created_at,
                  (SELECT COUNT(*) FROM drafts d WHERE d.user_id = u.id AND d.status = 'Draft') as draft_count,
                  (SELECT COUNT(*) FROM submissions s WHERE s.user_id = u.id) as submission_count
           FROM users u
           ORDER BY u.created_at DESC`
        )
        .all() as Record<string, unknown>[]);

  return rows.map((u) => ({
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    phone: u.phone || '',
    draftCount: Number(u.draft_count),
    submissionCount: Number(u.submission_count),
    createdAt: u.created_at,
  }));
}

export function listAllSubmissions(
  db: DatabaseSync,
  filters: { search?: string; status?: string } = {}
) {
  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.status && filters.status !== 'All') {
    conditions.push('s.status = ?');
    params.push(filters.status);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = `%${filters.search.trim().toLowerCase()}%`;
    conditions.push(
      '(LOWER(s.applicant_name) LIKE ? OR LOWER(s.applicant_email) LIKE ? OR LOWER(s.reference_code) LIKE ? OR LOWER(s.title) LIKE ?)'
    );
    params.push(q, q, q, q);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT s.id, s.reference_code, s.draft_id, s.user_id, s.title, s.applicant_name, s.applicant_email,
              s.status, s.submitted_at, s.updated_at,
              (SELECT COUNT(*) FROM uploaded_files uf WHERE uf.draft_id = s.draft_id) as file_count
       FROM submissions s
       ${whereClause}
       ORDER BY s.submitted_at DESC`
    )
    .all(...params) as Record<string, unknown>[];

  return rows.map((s) => ({
    id: s.id,
    referenceCode: s.reference_code,
    draftId: s.draft_id,
    userId: s.user_id,
    title: s.title,
    applicantName: s.applicant_name,
    applicantEmail: s.applicant_email,
    status: s.status,
    fileCount: Number(s.file_count),
    submittedAt: s.submitted_at,
    updatedAt: s.updated_at,
  }));
}

export function updateSubmissionStatus(
  db: DatabaseSync,
  submissionId: string,
  adminUserId: string,
  input: { status: 'Submitted' | 'Under Review' | 'Approved' | 'Rejected'; note?: string }
) {
  return withTransaction(db, () => {
    const existing = db
      .prepare('SELECT id, status FROM submissions WHERE id = ?')
      .get(submissionId) as { id: string; status: string } | undefined;

    if (!existing) {
      throw new AppError(404, 'SUBMISSION_NOT_FOUND', 'Submitted application not found.');
    }

    const now = new Date().toISOString();

    db.prepare('UPDATE submissions SET status = ?, admin_notes = ?, updated_at = ? WHERE id = ?').run(
      input.status,
      input.note || '',
      now,
      submissionId
    );

    db.prepare(
      `INSERT INTO application_status_history (id, submission_id, previous_status, new_status, changed_by_user_id, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      submissionId,
      existing.status,
      input.status,
      adminUserId,
      input.note || `Status updated to ${input.status}`,
      now
    );

    return getSubmissionDetail(db, submissionId, { id: adminUserId, role: 'admin' });
  });
}
