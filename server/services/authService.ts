import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getEnvConfig } from '../config/env.ts';
import { withTransaction } from '../db/connection.ts';
import { AppError } from '../middleware/errorHandler.ts';

export interface SafeUser {
  id: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin';
  phone: string;
  bio: string;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: 'user' | 'admin';
  phone: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    return false;
  }
  const [, salt, originalHex] = parts;
  if (!salt || !originalHex) {
    return false;
  }
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  const originalBuffer = Buffer.from(originalHex, 'hex');
  if (derivedBuffer.length !== originalBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(derivedBuffer, originalBuffer);
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function toSafeUser(row: UserRow): SafeUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    phone: row.phone || '',
    bio: row.bio || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createSession(
  db: DatabaseSync,
  userId: string,
  meta: { ipAddress?: string; userAgent?: string } = {}
): { sessionToken: string; csrfToken: string; expiresAt: string } {
  const config = getEnvConfig();
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const sessionId = sha256Hex(sessionToken);
  const csrfToken = crypto.randomBytes(24).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlMs).toISOString();
  const nowIso = now.toISOString();

  db.prepare(
    `INSERT INTO sessions (id, user_id, csrf_token, ip_address, user_agent, expires_at, created_at, last_active_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    userId,
    csrfToken,
    (meta.ipAddress || '').slice(0, 100),
    (meta.userAgent || '').slice(0, 250),
    expiresAt,
    nowIso,
    nowIso
  );

  return { sessionToken, csrfToken, expiresAt };
}

export function deleteSessionByToken(db: DatabaseSync, sessionToken: string | undefined): void {
  if (!sessionToken) return;
  const sessionId = sha256Hex(sessionToken);
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
}

export function pruneExpiredAuthRecords(db: DatabaseSync): void {
  const nowIso = new Date().toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso);
  db.prepare('DELETE FROM password_reset_tokens WHERE expires_at <= ? OR used_at IS NOT NULL').run(
    nowIso
  );
}

export function getSessionAndUser(
  db: DatabaseSync,
  sessionToken: string | undefined
): { user: SafeUser; csrfToken: string; sessionId: string } | null {
  if (!sessionToken) return null;
  const sessionId = sha256Hex(sessionToken);
  const row = db
    .prepare(
      `SELECT s.id as session_id, s.csrf_token, s.expires_at,
              u.id, u.email, u.full_name, u.password_hash, u.role, u.phone, u.bio, u.created_at, u.updated_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(sessionId) as
    | (UserRow & { session_id: string; csrf_token: string; expires_at: string })
    | undefined;

  if (!row) return null;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    return null;
  }

  db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    sessionId
  );

  return {
    user: toSafeUser(row),
    csrfToken: row.csrf_token,
    sessionId: row.session_id,
  };
}

export function registerUser(
  db: DatabaseSync,
  input: { fullName: string; email: string; password: string },
  meta: { oldSessionToken?: string; ipAddress?: string; userAgent?: string } = {}
) {
  const email = input.email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email address already exists.');
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(input.password);

  return withTransaction(db, () => {
    pruneExpiredAuthRecords(db);
    // Session fixation protection: destroy any pre-existing session
    if (meta.oldSessionToken) {
      deleteSessionByToken(db, meta.oldSessionToken);
    }

    db.prepare(
      `INSERT INTO users (id, email, full_name, password_hash, role, phone, bio, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', '', '', ?, ?)`
    ).run(userId, email, input.fullName.trim(), passwordHash, now, now);

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
    const session = createSession(db, userId, meta);
    return { user: toSafeUser(row), ...session };
  });
}

export function loginUser(
  db: DatabaseSync,
  input: { email: string; password: string },
  meta: { oldSessionToken?: string; ipAddress?: string; userAgent?: string; requireAdmin?: boolean } = {}
) {
  const email = input.email.trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as unknown as UserRow | undefined;

  if (!row || !verifyPassword(input.password, row.password_hash)) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (meta.requireAdmin && row.role !== 'admin') {
    throw new AppError(403, 'ADMIN_REQUIRED', 'Administrator privileges are required for this portal.');
  }

  return withTransaction(db, () => {
    pruneExpiredAuthRecords(db);
    // Session fixation protection: always rotate session ID on login
    if (meta.oldSessionToken) {
      deleteSessionByToken(db, meta.oldSessionToken);
    }
    const session = createSession(db, row.id, meta);
    return { user: toSafeUser(row), ...session };
  });
}

export function updateUserProfile(
  db: DatabaseSync,
  userId: string,
  input: { fullName: string; phone: string; bio: string }
): SafeUser {
  const now = new Date().toISOString();
  const result = db
    .prepare('UPDATE users SET full_name = ?, phone = ?, bio = ?, updated_at = ? WHERE id = ?')
    .run(input.fullName.trim(), input.phone.trim(), input.bio.trim(), now, userId);

  if (Number(result.changes) === 0) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User account not found.');
  }

  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
  return toSafeUser(row);
}

export function createPasswordResetRequest(db: DatabaseSync, emailInput: string) {
  const email = emailInput.trim().toLowerCase();
  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email) as
    | { id: string; email: string }
    | undefined;

  if (!user) {
    // Do not reveal account existence
    return {
      accepted: true,
      emailDeliveryConfigured: false,
      message: 'If an account matches that email, password reset instructions are ready.',
    };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  withTransaction(db, () => {
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL').run(user.id);
    db.prepare(
      `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), user.id, tokenHash, expiresAt, now.toISOString());
  });

  const config = getEnvConfig();
  const isProd = config.nodeEnv === 'production';

  return {
    accepted: true,
    emailDeliveryConfigured: false,
    message:
      'If an account matches that email, a reset token has been generated. SMTP is not configured in this local environment; use the development reset link below.',
    ...(!isProd
      ? {
          devResetToken: rawToken,
          devResetPath: `/reset-password?token=${rawToken}`,
          expiresAt,
        }
      : {}),
  };
}

export function resetPasswordWithToken(db: DatabaseSync, rawToken: string, newPassword: string) {
  const tokenHash = sha256Hex(rawToken.trim());
  const row = db
    .prepare('SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?')
    .get(tokenHash) as
    | { id: string; user_id: string; expires_at: string; used_at: string | null }
    | undefined;

  if (!row || row.used_at !== null || new Date(row.expires_at).getTime() <= Date.now()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'This password reset link is invalid or has expired.');
  }

  const now = new Date().toISOString();
  const passwordHash = hashPassword(newPassword);

  withTransaction(db, () => {
    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
      passwordHash,
      now,
      row.user_id
    );
    db.prepare('UPDATE password_reset_tokens SET used_at = ? WHERE id = ?').run(now, row.id);
    // Revoke all active sessions after password change
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
  });

  return { reset: true };
}

export function getAdminBootstrapStatus(db: DatabaseSync): {
  needsBootstrap: boolean;
  requiresSetupPasscode: boolean;
} {
  const row = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'admin'").get() as {
    total: number;
  };
  const config = getEnvConfig();
  return {
    needsBootstrap: Number(row.total) === 0,
    requiresSetupPasscode: config.adminSetupPasscode.length > 0 || config.nodeEnv === 'production',
  };
}

export function bootstrapInitialAdmin(
  db: DatabaseSync,
  input: { fullName: string; email: string; password: string; setupPasscode?: string },
  meta: { oldSessionToken?: string; ipAddress?: string; userAgent?: string } = {}
) {
  const config = getEnvConfig();
  if (config.nodeEnv === 'production' && config.adminSetupPasscode.length === 0) {
    throw new AppError(503, 'ADMIN_SETUP_NOT_CONFIGURED', 'Set ADMIN_SETUP_PASSCODE before initializing the first administrator in production.');
  }
  if (config.adminSetupPasscode.length > 0) {
    const expectedHash = crypto.createHash('sha256').update(config.adminSetupPasscode).digest();
    const actualHash = crypto.createHash('sha256').update(input.setupPasscode || '').digest();
    if (!crypto.timingSafeEqual(expectedHash, actualHash)) {
      throw new AppError(403, 'INVALID_SETUP_PASSCODE', 'Invalid administrator setup passcode.');
    }
  }

  const email = input.email.trim().toLowerCase();

  return withTransaction(db, () => {
    const adminCount = db
      .prepare("SELECT COUNT(*) as total FROM users WHERE role = 'admin'")
      .get() as { total: number };
    if (Number(adminCount.total) > 0) {
      throw new AppError(
        403,
        'ADMIN_ALREADY_CONFIGURED',
        'An administrator account has already been initialized.'
      );
    }

    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    if (meta.oldSessionToken) {
      deleteSessionByToken(db, meta.oldSessionToken);
    }

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = hashPassword(input.password);

    db.prepare(
      `INSERT INTO users (id, email, full_name, password_hash, role, phone, bio, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', '', '', ?, ?)`
    ).run(userId, email, input.fullName.trim(), passwordHash, now, now);

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
    const session = createSession(db, userId, meta);
    return { user: toSafeUser(row), ...session };
  });
}
