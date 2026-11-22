import type { DatabaseSync } from 'node:sqlite';

interface Migration {
  name: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    name: '001_initial_schema',
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        phone TEXT DEFAULT '',
        bio TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        csrf_token TEXT NOT NULL,
        ip_address TEXT DEFAULT '',
        user_agent TEXT DEFAULT '',
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        form_type TEXT NOT NULL DEFAULT 'standard_application',
        current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 5),
        version INTEGER NOT NULL DEFAULT 1,
        share_token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted')),
        last_client_tab_id TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
      CREATE INDEX IF NOT EXISTS idx_drafts_share_token ON drafts(share_token);
      CREATE INDEX IF NOT EXISTS idx_drafts_updated_at ON drafts(updated_at DESC);

      CREATE TABLE IF NOT EXISTS form_responses (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL UNIQUE REFERENCES drafts(id) ON DELETE CASCADE,
        data_json TEXT NOT NULL DEFAULT '{}',
        completed_steps_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_form_responses_draft_id ON form_responses(draft_id);

      CREATE TABLE IF NOT EXISTS draft_versions (
        id TEXT PRIMARY KEY,
        draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        current_step INTEGER NOT NULL,
        data_json TEXT NOT NULL,
        saved_by_tab_id TEXT DEFAULT '',
        change_summary TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE (draft_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_draft_versions_draft_id ON draft_versions(draft_id, version DESC);

      CREATE TABLE IF NOT EXISTS uploaded_files (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        draft_id TEXT NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
        step_key TEXT NOT NULL DEFAULT 'step_4',
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        extension TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        checksum_sha256 TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_uploaded_files_draft ON uploaded_files(draft_id);
      CREATE INDEX IF NOT EXISTS idx_uploaded_files_user ON uploaded_files(user_id);

      CREATE TABLE IF NOT EXISTS submissions (
        id TEXT PRIMARY KEY,
        reference_code TEXT NOT NULL UNIQUE,
        draft_id TEXT NOT NULL UNIQUE REFERENCES drafts(id) ON DELETE RESTRICT,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        applicant_name TEXT NOT NULL,
        applicant_email TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Under Review', 'Approved', 'Rejected')),
        admin_notes TEXT DEFAULT '',
        submitted_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
      CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
      CREATE INDEX IF NOT EXISTS idx_submissions_submitted_at ON submissions(submitted_at DESC);

      CREATE TABLE IF NOT EXISTS application_status_history (
        id TEXT PRIMARY KEY,
        submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
        previous_status TEXT,
        new_status TEXT NOT NULL,
        changed_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        note TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_status_history_submission ON application_status_history(submission_id, created_at ASC);
    `,
  },
];

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    );
  `);

  const existingStmt = db.prepare('SELECT name FROM migrations');
  const existingRows = existingStmt.all() as { name: string }[];
  const applied = new Set(existingRows.map((row) => row.name));

  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.name)) {
      db.exec('BEGIN IMMEDIATE;');
      try {
        db.exec(migration.sql);
        db.prepare('INSERT INTO migrations (name, applied_at) VALUES (?, ?)').run(
          migration.name,
          new Date().toISOString()
        );
        db.exec('COMMIT;');
      } catch (err) {
        db.exec('ROLLBACK;');
        throw err;
      }
    }
  }
}
